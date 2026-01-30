import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { preparePrompts } from '~/lib/prompt-interpolation';
import type { Route } from './+types/prompts.run';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const anthropic = createAnthropic({
    apiKey: context.cloudflare.env.ANTHROPIC_API_KEY,
  });

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

  const formData = await request.formData();
  const promptId = formData.get('promptId') as string;
  const versionNumber = formData.get('version') as string | null;
  const model =
    (formData.get('model') as string) || 'anthropic/claude-haiku-4.5';
  const temperature = Number.parseFloat(
    (formData.get('temperature') as string) || '0.5',
  );
  const inputDataJson = formData.get('inputData') as string | null;
  const inputDataRootName = formData.get('inputDataRootName') as string | null;

  if (!promptId) {
    return data({ error: 'Missing promptId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  let promptVersion: {
    id: string;
    system_message: string | null;
    user_message: string | null;
  } | null = null;

  if (versionNumber === 'draft') {
    // Fetch the latest draft version (unpublished)
    promptVersion = await db
      .prepare(
        'SELECT id, system_message, user_message FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        id: string;
        system_message: string | null;
        user_message: string | null;
      }>();
  } else if (versionNumber) {
    // Parse semver format (e.g., "1.2.3")
    const match = versionNumber.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      const major = Number.parseInt(match[1], 10);
      const minor = Number.parseInt(match[2], 10);
      const patch = Number.parseInt(match[3], 10);

      promptVersion = await db
        .prepare(
          'SELECT id, system_message, user_message FROM prompt_version WHERE prompt_id = ? AND major = ? AND minor = ? AND patch = ?',
        )
        .bind(promptId, major, minor, patch)
        .first<{
          id: string;
          system_message: string | null;
          user_message: string | null;
        }>();
    }
  } else {
    // Return most recent published version (exclude drafts where major/minor/patch are NULL)
    promptVersion = await db
      .prepare(
        'SELECT id, system_message, user_message FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        id: string;
        system_message: string | null;
        user_message: string | null;
      }>();
  }

  if (!promptVersion) {
    return data({ error: 'Prompt version not found' }, { status: 404 });
  }

  const prepared = preparePrompts({
    systemMessage: promptVersion.system_message || '',
    userMessage: promptVersion.user_message || '',
    inputDataJson,
    inputDataRootName,
  });

  if (prepared.error) {
    console.warn('Prompt interpolation warning:', prepared.error);
  }

  // Calculate character lengths for proportional token distribution
  const systemLength = prepared.systemMessage.length;
  const userLength = prepared.userMessage.length;
  const totalLength = systemLength + userLength;

  const versionId = promptVersion.id;

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: prepared.systemMessage,
    prompt: prepared.userMessage,
    temperature,
  });

  // After the response is sent, update the database with token counts
  context.cloudflare.ctx.waitUntil(
    result.usage.then(async (usage) => {
      if (versionId && usage) {
        const { inputTokens, outputTokens } = usage;

        // Distribute input tokens proportionally by character length
        let systemInputTokens: number | null = null;
        let userInputTokens: number | null = null;

        if (inputTokens && totalLength > 0) {
          const systemRatio = systemLength / totalLength;
          systemInputTokens = Math.round(inputTokens * systemRatio);
          userInputTokens = inputTokens - systemInputTokens; // Ensure they sum exactly
        }

        await db
          .prepare(
            `UPDATE prompt_version
             SET last_output_tokens = ?,
                 last_system_input_tokens = ?,
                 last_user_input_tokens = ?
             WHERE id = ?`,
          )
          .bind(
            outputTokens ?? null,
            systemInputTokens,
            userInputTokens,
            versionId,
          )
          .run();
      }
    }),
  );

  const response = result.toTextStreamResponse();
  if (prepared.unusedFields.length > 0) {
    response.headers.set(
      'X-Unused-Fields',
      JSON.stringify(prepared.unusedFields),
    );
  }
  return response;
};
