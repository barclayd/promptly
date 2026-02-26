import { streamText } from 'ai';
import { data } from 'react-router';
import { orgContext, sessionContext } from '~/context';
import { resolveModelForOrg } from '~/lib/resolve-model.server';
import type { Route } from './+types/snippets.run';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = context.get(sessionContext);

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const snippetId = formData.get('snippetId') as string;
  const versionNumber = formData.get('version') as string | null;
  const requestedModel = formData.get('model') as string | null;
  const userMessage = formData.get('userMessage') as string | null;

  if (!snippetId) {
    return data({ error: 'Missing snippetId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const snippetOwnership = await db
    .prepare('SELECT id FROM snippet WHERE id = ? AND organization_id = ?')
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippetOwnership) {
    return data({ error: 'Snippet not found' }, { status: 404 });
  }

  let snippetVersion: {
    id: string;
    content: string | null;
  } | null = null;

  if (versionNumber === 'draft') {
    snippetVersion = await db
      .prepare(
        'SELECT id, content FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
      )
      .bind(snippetId)
      .first<{ id: string; content: string | null }>();
  } else if (versionNumber) {
    const match = versionNumber.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      const major = Number.parseInt(match[1], 10);
      const minor = Number.parseInt(match[2], 10);
      const patch = Number.parseInt(match[3], 10);

      snippetVersion = await db
        .prepare(
          'SELECT id, content FROM snippet_version WHERE snippet_id = ? AND major = ? AND minor = ? AND patch = ?',
        )
        .bind(snippetId, major, minor, patch)
        .first<{ id: string; content: string | null }>();
    }
  } else {
    snippetVersion = await db
      .prepare(
        'SELECT id, content FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(snippetId)
      .first<{ id: string; content: string | null }>();
  }

  if (!snippetVersion) {
    return data({ error: 'Snippet version not found' }, { status: 404 });
  }

  const snippetContent = snippetVersion.content || '';
  const versionId = snippetVersion.id;

  // Resolve model: try org LLM key first, then fall back to env var
  const modelId = requestedModel || 'claude-haiku-4.5';

  const modelResult = await resolveModelForOrg({
    db,
    organizationId: org.organizationId,
    modelId,
    encryptionKey: context.cloudflare.env.API_KEY_ENCRYPTION_KEY,
    systemAnthropicKey: context.cloudflare.env.ANTHROPIC_API_KEY,
  });

  if (!modelResult.ok) {
    return data(
      { error: modelResult.error, errorType: modelResult.errorType },
      { status: modelResult.status },
    );
  }

  const modelInstance = modelResult.model;

  // Capture stream errors — onError swallows them so the textStream
  // iterator completes normally without throwing
  let streamError: string | null = null;

  const result = streamText({
    model: modelInstance,
    system: snippetContent,
    prompt: userMessage || '',
    temperature: 0,
    onError: ({ error }) => {
      console.error('streamText error:', error);
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

          await db
            .prepare(
              `UPDATE snippet_version
             SET last_output_tokens = ?,
                 last_system_input_tokens = ?
             WHERE id = ?`,
            )
            .bind(outputTokens ?? null, inputTokens ?? null, versionId)
            .run();
        }
      })
      .catch((err) => {
        console.error('waitUntil usage error:', err);
      }),
  );

  // Wrap the text stream to surface errors to the client.
  const textStream = result.textStream;
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const pumpStream = async () => {
    try {
      for await (const chunk of textStream) {
        await writer.write(encoder.encode(chunk));
      }
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
  return new Response(readable, { headers });
};
