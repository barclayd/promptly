import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippet-info';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);
  const session = await auth.api.getSession({ headers: request.headers });

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
    .prepare(
      'SELECT id, name, folder_id FROM snippet WHERE id = ? AND organization_id = ?',
    )
    .bind(snippetId, org.organizationId)
    .first<{ id: string; name: string; folder_id: string }>();

  if (!snippet) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [folder, versionResult] = await Promise.all([
    db
      .prepare(
        'SELECT id, name FROM snippet_folder WHERE id = ? AND organization_id = ?',
      )
      .bind(snippet.folder_id, org.organizationId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT major, minor, patch FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(snippetId)
      .first<{ major: number; minor: number; patch: number }>(),
  ]);

  if (!folder) {
    return Response.json({ error: 'Folder not found' }, { status: 404 });
  }

  return Response.json({
    snippetId: snippet.id,
    snippetName: snippet.name,
    folderId: folder.id,
    folderName: folder.name,
    version: versionResult
      ? `${versionResult.major}.${versionResult.minor}.${versionResult.patch}`
      : null,
    url: `/snippets/${snippetId}`,
  });
};
