import { orgContext, sessionContext } from '~/context';
import type { Route } from './+types/prompt-versions';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const session = context.get(sessionContext);

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = context.get(orgContext);
  if (!org) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const promptId = url.searchParams.get('promptId');

  if (!promptId) {
    return Response.json({ error: 'Missing promptId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Verify prompt belongs to the user's org and is not deleted
  const prompt = await db
    .prepare(
      'SELECT id FROM prompt WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(promptId, org.organizationId)
    .first<{ id: string }>();

  if (!prompt) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await db
    .prepare(
      `SELECT id, major, minor, patch FROM prompt_version
       WHERE prompt_id = ? AND published_at IS NOT NULL
       ORDER BY major DESC, minor DESC, patch DESC`,
    )
    .bind(promptId)
    .all<{ id: string; major: number; minor: number; patch: number }>();

  const versions = (result.results ?? []).map((v) => ({
    id: v.id,
    major: v.major,
    minor: v.minor,
    patch: v.patch,
  }));

  return Response.json({ versions });
};
