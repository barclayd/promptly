import { orgContext, sessionContext } from '~/context';
import type { Route } from './+types/prompt-schema';

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

  const versionId = url.searchParams.get('versionId');

  const db = context.cloudflare.env.promptly;

  const prompt = await db
    .prepare(
      'SELECT id, name FROM prompt WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(promptId, org.organizationId)
    .first<{ id: string; name: string }>();

  if (!prompt) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  type VersionRow = { id: string; config: string | null };

  let version: VersionRow | null = null;

  if (versionId) {
    version = await db
      .prepare(
        'SELECT id, config FROM prompt_version WHERE id = ? AND prompt_id = ?',
      )
      .bind(versionId, promptId)
      .first<VersionRow>();
  } else {
    version = await db
      .prepare(
        `SELECT id, config FROM prompt_version
				 WHERE prompt_id = ? AND published_at IS NOT NULL
				 ORDER BY major DESC, minor DESC, patch DESC
				 LIMIT 1`,
      )
      .bind(promptId)
      .first<VersionRow>();

    if (!version) {
      version = await db
        .prepare(
          `SELECT id, config FROM prompt_version
					 WHERE prompt_id = ? AND published_at IS NULL
					 ORDER BY created_at DESC
					 LIMIT 1`,
        )
        .bind(promptId)
        .first<VersionRow>();
    }
  }

  if (!version) {
    return Response.json(
      {
        promptId,
        promptName: prompt.name,
        versionId: null,
        schema: [],
      },
      { status: 200 },
    );
  }

  let schema: unknown[] = [];
  try {
    const parsed = JSON.parse(version.config ?? '{}');
    if (Array.isArray(parsed.schema)) {
      schema = parsed.schema;
    }
  } catch {
    schema = [];
  }

  return Response.json({
    promptId,
    promptName: prompt.name,
    versionId: version.id,
    schema,
  });
};
