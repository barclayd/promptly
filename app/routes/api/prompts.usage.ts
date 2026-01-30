import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.usage';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const promptId = url.searchParams.get('promptId');
  const versionNumber = url.searchParams.get('version');

  if (!promptId) {
    return data({ error: 'Missing promptId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Verify prompt ownership
  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  type TokenResult = {
    last_output_tokens: number | null;
    last_system_input_tokens: number | null;
    last_user_input_tokens: number | null;
  };

  let result: TokenResult | null = null;

  if (versionNumber === 'draft') {
    result = await db
      .prepare(
        'SELECT last_output_tokens, last_system_input_tokens, last_user_input_tokens FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
      )
      .bind(promptId)
      .first<TokenResult>();
  } else if (versionNumber) {
    const match = versionNumber.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      const major = Number.parseInt(match[1], 10);
      const minor = Number.parseInt(match[2], 10);
      const patch = Number.parseInt(match[3], 10);

      result = await db
        .prepare(
          'SELECT last_output_tokens, last_system_input_tokens, last_user_input_tokens FROM prompt_version WHERE prompt_id = ? AND major = ? AND minor = ? AND patch = ?',
        )
        .bind(promptId, major, minor, patch)
        .first<TokenResult>();
    }
  } else {
    // Get latest version (draft or published)
    result = await db
      .prepare(
        'SELECT last_output_tokens, last_system_input_tokens, last_user_input_tokens FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(promptId)
      .first<TokenResult>();
  }

  return data({
    outputTokens: result?.last_output_tokens ?? null,
    systemInputTokens: result?.last_system_input_tokens ?? null,
    userInputTokens: result?.last_user_input_tokens ?? null,
  });
};
