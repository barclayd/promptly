import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompt-info';

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
  const folderId = url.searchParams.get('folderId');
  const promptId = url.searchParams.get('promptId');

  if (!folderId || !promptId) {
    return Response.json(
      { error: 'Missing folderId or promptId' },
      { status: 400 },
    );
  }

  const db = context.cloudflare.env.promptly;

  const [folder, prompt, versionResult] = await Promise.all([
    db
      .prepare(
        'SELECT id, name FROM prompt_folder WHERE id = ? AND organization_id = ?',
      )
      .bind(folderId, org.organizationId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT id, name FROM prompt WHERE id = ? AND folder_id = ? AND organization_id = ?',
      )
      .bind(promptId, folderId, org.organizationId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT version FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{ version: number }>(),
  ]);

  if (!folder || !prompt) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    promptId: prompt.id,
    promptName: prompt.name,
    folderId: folder.id,
    folderName: folder.name,
    version: versionResult?.version ? `${versionResult.version}.0.0` : null,
    url: `/prompts/${folderId}/${promptId}`,
  });
};
