import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.publish';

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

  const formData = await request.formData();
  const promptId = formData.get('promptId') as string;
  const version = formData.get('version') as string;

  if (!promptId) {
    return data({ error: 'Missing promptId' }, { status: 400 });
  }

  const versionMatch = version?.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!versionMatch) {
    return data({ error: 'Invalid version format (expected X.X.X)' }, { status: 400 });
  }

  const majorVersion = Number.parseInt(versionMatch[1], 10);

  const db = context.cloudflare.env.promptly;

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  const currentDraft = await db
    .prepare(
      'SELECT id, version FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ id: string; version: number }>();

  if (!currentDraft) {
    return data({ error: 'No draft version to publish' }, { status: 400 });
  }

  const lastPublished = await db
    .prepare(
      'SELECT version FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ version: number }>();

  if (lastPublished && majorVersion <= lastPublished.version) {
    return data(
      { error: `Version must be greater than ${lastPublished.version}.0.0` },
      { status: 400 },
    );
  }

  await db
    .prepare('UPDATE prompt_version SET version = ?, published_at = ? WHERE id = ?')
    .bind(majorVersion, Date.now(), currentDraft.id)
    .run();

  await db
    .prepare('UPDATE prompt SET updated_at = ? WHERE id = ?')
    .bind(Date.now(), promptId)
    .run();

  return { success: true, version: majorVersion };
};
