import type { Route } from './+types/prompts.get';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const promptId = url.searchParams.get('promptId');
  const version = url.searchParams.get('version');

  if (!promptId) {
    return Response.json(
      { error: 'Missing promptId parameter' },
      { status: 400 },
    );
  }

  const db = context.cloudflare.env.promptly;

  const prompt = await db
    .prepare('SELECT id, name FROM prompt WHERE id = ?')
    .bind(promptId)
    .first<{ id: string; name: string }>();

  if (!prompt) {
    return Response.json({ error: 'Prompt not found' }, { status: 404 });
  }

  let versionData;

  if (version) {
    const [major, minor, patch] = version.split('.').map(Number);
    versionData = await db
      .prepare(
        'SELECT system_message, user_message, config, major, minor, patch FROM prompt_version WHERE prompt_id = ? AND major = ? AND minor = ? AND patch = ?',
      )
      .bind(promptId, major, minor, patch)
      .first<{
        system_message: string | null;
        user_message: string | null;
        config: string;
        major: number;
        minor: number;
        patch: number;
      }>();
  } else {
    versionData = await db
      .prepare(
        'SELECT system_message, user_message, config, major, minor, patch FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL), major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        system_message: string | null;
        user_message: string | null;
        config: string;
        major: number | null;
        minor: number | null;
        patch: number | null;
      }>();
  }

  if (!versionData) {
    return Response.json({ error: 'Version not found' }, { status: 404 });
  }

  let config = {};
  try {
    config = JSON.parse(versionData.config || '{}');
  } catch {
    // Keep empty object
  }

  return Response.json({
    promptId: prompt.id,
    promptName: prompt.name,
    version:
      versionData.major !== null
        ? `${versionData.major}.${versionData.minor}.${versionData.patch}`
        : 'draft',
    systemMessage: versionData.system_message ?? '',
    userMessage: versionData.user_message ?? '',
    config,
  });
};
