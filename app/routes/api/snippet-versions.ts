import { orgContext, sessionContext } from '~/context';
import type { Route } from './+types/snippet-versions';

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
  const snippetId = url.searchParams.get('snippetId');

  if (!snippetId) {
    return Response.json({ error: 'Missing snippetId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const snippet = await db
    .prepare('SELECT id FROM snippet WHERE id = ? AND organization_id = ?')
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippet) {
    return Response.json({ error: 'Snippet not found' }, { status: 404 });
  }

  const result = await db
    .prepare(
      `SELECT id, major, minor, patch, published_at
       FROM snippet_version
       WHERE snippet_id = ? AND published_at IS NOT NULL
       ORDER BY major DESC, minor DESC, patch DESC`,
    )
    .bind(snippetId)
    .all<{
      id: string;
      major: number;
      minor: number;
      patch: number;
      published_at: number;
    }>();

  return Response.json({
    versions: result.results.map((v) => ({
      id: v.id,
      major: v.major,
      minor: v.minor,
      patch: v.patch,
      publishedAt: v.published_at,
    })),
  });
};
