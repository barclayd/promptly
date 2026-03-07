import { orgContext, sessionContext } from '~/context';
import type { Route } from './+types/search-snippets';

type SnippetResult = {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  folder_name: string | null;
};

type SearchSnippetItem = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  folderName: string | null;
};

export const loader = async ({ context }: Route.LoaderArgs) => {
  const session = context.get(sessionContext);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = context.get(orgContext);
  if (!org) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = context.cloudflare.env.promptly;

  const results = await db
    .prepare(
      `SELECT
        s.id,
        s.name,
        s.description,
        s.folder_id,
        sf.name as folder_name
      FROM snippet s
      LEFT JOIN snippet_folder sf ON s.folder_id = sf.id
      WHERE s.organization_id = ? AND s.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM snippet_version WHERE snippet_id = s.id AND published_at IS NOT NULL)
      ORDER BY s.name ASC`,
    )
    .bind(org.organizationId)
    .all<SnippetResult>();

  const snippets: SearchSnippetItem[] = results.results.map(
    (snippet: SnippetResult) => ({
      id: snippet.id,
      name: snippet.name,
      description: snippet.description,
      folderId: snippet.folder_id,
      folderName: snippet.folder_name,
    }),
  );

  return Response.json({ snippets });
};
