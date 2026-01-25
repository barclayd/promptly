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
  const promptId = url.searchParams.get('promptId');

  if (!promptId) {
    return Response.json({ error: 'Missing promptId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const prompt = await db
    .prepare(
      'SELECT id, name, folder_id FROM prompt WHERE id = ? AND organization_id = ?',
    )
    .bind(promptId, org.organizationId)
    .first<{ id: string; name: string; folder_id: string }>();

  if (!prompt) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [folder, versionResult] = await Promise.all([
    db
      .prepare(
        'SELECT id, name FROM prompt_folder WHERE id = ? AND organization_id = ?',
      )
      .bind(prompt.folder_id, org.organizationId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT major, minor, patch FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{ major: number; minor: number; patch: number }>(),
  ]);

  if (!folder) {
    return Response.json({ error: 'Folder not found' }, { status: 404 });
  }

  return Response.json({
    promptId: prompt.id,
    promptName: prompt.name,
    folderId: folder.id,
    folderName: folder.name,
    version: versionResult
      ? `${versionResult.major}.${versionResult.minor}.${versionResult.patch}`
      : null,
    url: `/prompts/${promptId}`,
  });
};
