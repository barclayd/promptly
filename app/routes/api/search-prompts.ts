import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/search-prompts';

type PromptResult = {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  folder_name: string | null;
};

type SearchPromptItem = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  folderName: string | null;
  url: string;
};

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

  const db = context.cloudflare.env.promptly;

  const results = await db
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.folder_id,
        pf.name as folder_name
      FROM prompt p
      LEFT JOIN prompt_folder pf ON p.folder_id = pf.id
      WHERE p.organization_id = ? AND p.deleted_at IS NULL
      ORDER BY p.name ASC`,
    )
    .bind(org.organizationId)
    .all<PromptResult>();

  const prompts: SearchPromptItem[] = results.results.map((prompt: PromptResult) => ({
    id: prompt.id,
    name: prompt.name,
    description: prompt.description,
    folderId: prompt.folder_id,
    folderName: prompt.folder_name,
    url: `/prompts/${prompt.id}`,
  }));

  return Response.json({ prompts });
};
