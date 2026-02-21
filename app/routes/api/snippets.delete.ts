import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { deleteSnippetSchema } from '~/lib/validations/snippet';
import type { Route } from './+types/snippets.delete';

type Member = {
  userId: string;
  role: 'member' | 'admin' | 'owner';
};

type FullOrganization = {
  members?: Member[];
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check if user is owner
  const orgResponse = await auth.api.getFullOrganization({
    query: { organizationId: org.organizationId },
    headers: request.headers,
    asResponse: true,
  });
  const fullOrg = (await orgResponse.json()) as FullOrganization | null;
  const currentUserMember = fullOrg?.members?.find(
    (m) => m.userId === session.user.id,
  );

  if (currentUserMember?.role !== 'owner') {
    return data(
      { error: 'Only workspace owners can delete snippets' },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const result = deleteSnippetSchema.safeParse({
    snippetId: formData.get('snippetId'),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError = fieldErrors.snippetId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { snippetId } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify snippet ownership
  const snippetOwnership = await db
    .prepare('SELECT id FROM snippet WHERE id = ? AND organization_id = ?')
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippetOwnership) {
    return data({ error: 'Snippet not found' }, { status: 404 });
  }

  // Soft delete the snippet
  await db
    .prepare('UPDATE snippet SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), snippetId)
    .run();

  return { success: true };
};
