import { data, redirect } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/settings.delete-llm-api-key';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;

  if (!id) {
    return data({ error: 'Key ID is required' }, { status: 400 });
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const org = context.get(orgContext);

  if (!org) {
    return data({ error: 'Organization not found' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Check user is admin or owner
  const member = await db
    .prepare(
      'SELECT role FROM member WHERE user_id = ? AND organization_id = ?',
    )
    .bind(session.user.id, org.organizationId)
    .first<{ role: string }>();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return data(
      { error: 'Only admins can manage LLM API keys' },
      { status: 403 },
    );
  }

  // Verify key belongs to this org
  const key = await db
    .prepare('SELECT id FROM llm_api_key WHERE id = ? AND organization_id = ?')
    .bind(id, org.organizationId)
    .first();

  if (!key) {
    return data({ error: 'Key not found' }, { status: 404 });
  }

  await db.prepare('DELETE FROM llm_api_key WHERE id = ?').bind(id).run();

  return redirect('/settings?tab=llm-api-keys');
};
