import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { streamText } from 'ai';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { decryptApiKey } from '~/lib/encryption.server';
import { getLlmApiKeyForModel } from '~/lib/llm-api-keys.server';
import { createModelInstance } from '~/lib/model-dispatch.server';
import { getProviderFromModelId } from '~/lib/model-pricing';
import { preparePrompts } from '~/lib/prompt-interpolation';
import type { Route } from './+types/prompts.run';

export const action = async ({ request, context }: Route.ActionArgs) => {
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
  const requestedModel = formData.get('model') as string | null;
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

  // Resolve model: try org LLM key first, then fall back to env var
  const modelId = requestedModel || 'claude-haiku-4.5';
  let modelInstance: LanguageModel;

  const orgKey = await getLlmApiKeyForModel(db, org.organizationId, modelId);

  if (orgKey) {
    try {
      const encryptionKey = context.cloudflare.env.API_KEY_ENCRYPTION_KEY;
      const apiKey = await decryptApiKey(orgKey.encryptedKey, encryptionKey);
      const provider = getProviderFromModelId(modelId);
      modelInstance = createModelInstance(modelId, apiKey, provider);
    } catch (err) {
      console.error('Failed to decrypt/create model:', err);
      return data(
        {
          error: 'Failed to initialize model with stored API key',
          errorType: 'AUTH_ERROR',
        },
        { status: 500 },
      );
    }
  } else if (context.cloudflare.env.ANTHROPIC_API_KEY) {
    // Fallback: use env var for onboarding / default
    const anthropic = createAnthropic({
      apiKey: context.cloudflare.env.ANTHROPIC_API_KEY,
    });
    modelInstance = anthropic('claude-haiku-4-5-20251001');
  } else {
    return data(
      { error: 'No API key configured for this model' },
      { status: 400 },
    );
  }

  // Capture stream errors — onError swallows them so the textStream
  // iterator completes normally without throwing
  let streamError: string | null = null;

  const result = streamText({
    model: modelInstance,
    system: prepared.systemMessage,
    prompt: prepared.userMessage,
    temperature,
    onError: ({ error }) => {
      console.error('streamText error:', error);
      // Extract a user-friendly message from the AI SDK error
      let message: string;
      let isAuthError = false;
      if (error && typeof error === 'object' && 'data' in error) {
        const apiError = error as {
          data?: { error?: { message?: string; type?: string } };
        };
        message = apiError.data?.error?.message ?? String(error);
        const errorType = apiError.data?.error?.type;
        isAuthError =
          errorType === 'authentication_error' ||
          /invalid.*(x-)?api[- ]?key|invalid.*auth|unauthorized|authentication/i.test(
            message,
          );
      } else {
        message =
          error instanceof Error ? error.message : 'Unknown streaming error';
        isAuthError =
          /invalid.*(x-)?api[- ]?key|invalid.*auth|unauthorized|authentication/i.test(
            message,
          );
      }
      streamError = `${isAuthError ? 'AUTH_ERROR' : 'STREAM_ERROR'}:${message}`;
    },
  });

  // After the response is sent, update the database with token counts
  context.cloudflare.ctx.waitUntil(
    Promise.resolve(result.usage)
      .then(async (usage) => {
        if (versionId && usage) {
          const { inputTokens, outputTokens } = usage;

          let systemInputTokens: number | null = null;
          let userInputTokens: number | null = null;

          if (inputTokens && totalLength > 0) {
            const systemRatio = systemLength / totalLength;
            systemInputTokens = Math.round(inputTokens * systemRatio);
            userInputTokens = inputTokens - systemInputTokens;
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
      })
      .catch((err) => {
        console.error('waitUntil usage error:', err);
      }),
  );

  // Wrap the text stream to surface errors to the client.
  // The AI SDK's onError callback swallows errors, so textStream
  // completes normally — we check streamError after iteration.
  const textStream = result.textStream;
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const pumpStream = async () => {
    try {
      for await (const chunk of textStream) {
        await writer.write(encoder.encode(chunk));
      }
      // Stream completed — check if onError captured an error
      if (streamError) {
        await writer.write(encoder.encode(`[Error:${streamError}]`));
      }
      await writer.close();
    } catch (err) {
      console.error('Stream error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown streaming error';
      await writer.write(
        encoder.encode(`[Error:STREAM_ERROR:${errorMessage}]`),
      );
      await writer.close();
    }
  };

  context.cloudflare.ctx.waitUntil(pumpStream());

  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  if (prepared.unusedFields.length > 0) {
    headers.set('X-Unused-Fields', JSON.stringify(prepared.unusedFields));
  }
  return new Response(readable, { headers });
};
