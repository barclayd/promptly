import { generateText } from 'ai';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import {
  type ComposerSegment,
  parseComposerContent,
  replaceVariableRefs,
} from '~/lib/composer-content-parser';
import { preparePrompts } from '~/lib/prompt-interpolation';
import { resolveModelForOrg } from '~/lib/resolve-model.server';
import type { Route } from './+types/composers.run';

type PromptVersionRow = {
  id: string;
  system_message: string | null;
  user_message: string | null;
  config: string;
};

type JunctionRow = {
  prompt_id: string;
  prompt_version_id: string | null;
};

type PromptInfo = {
  promptId: string;
  promptName: string;
  versionId: string;
  systemMessage: string;
  userMessage: string;
  model: string;
  temperature: number;
};

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
  const composerId = formData.get('composerId') as string;
  const versionNumber = formData.get('version') as string | null;
  const inputDataJson = formData.get('inputData') as string | null;
  const inputDataRootName = formData.get('inputDataRootName') as string | null;

  if (!composerId) {
    return data({ error: 'Missing composerId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Verify composer ownership
  const composer = await db
    .prepare(
      'SELECT id, name FROM composer WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(composerId, org.organizationId)
    .first<{ id: string; name: string }>();

  if (!composer) {
    return data({ error: 'Composer not found' }, { status: 404 });
  }

  // Resolve composer version (same 3-way pattern as prompts.run)
  let composerVersion: {
    id: string;
    content: string | null;
    config: string;
  } | null = null;

  if (versionNumber === 'draft') {
    composerVersion = await db
      .prepare(
        'SELECT id, content, config FROM composer_version WHERE composer_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
      )
      .bind(composerId)
      .first<{ id: string; content: string | null; config: string }>();
  } else if (versionNumber) {
    const match = versionNumber.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      const major = Number.parseInt(match[1], 10);
      const minor = Number.parseInt(match[2], 10);
      const patch = Number.parseInt(match[3], 10);

      composerVersion = await db
        .prepare(
          'SELECT id, content, config FROM composer_version WHERE composer_id = ? AND major = ? AND minor = ? AND patch = ?',
        )
        .bind(composerId, major, minor, patch)
        .first<{ id: string; content: string | null; config: string }>();
    }
  } else {
    // Latest published version
    composerVersion = await db
      .prepare(
        'SELECT id, content, config FROM composer_version WHERE composer_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
      )
      .bind(composerId)
      .first<{ id: string; content: string | null; config: string }>();
  }

  if (!composerVersion) {
    return data({ error: 'Composer version not found' }, { status: 404 });
  }

  const content = composerVersion.content ?? '';
  const segments = parseComposerContent(content);

  // Pre-fetch junction table for version pins
  const junctionRows = await db
    .prepare(
      'SELECT prompt_id, prompt_version_id FROM composer_version_prompt WHERE composer_version_id = ?',
    )
    .bind(composerVersion.id)
    .all<JunctionRow>();

  const junctionMap = new Map<string, string | null>();
  for (const row of junctionRows.results ?? []) {
    junctionMap.set(row.prompt_id, row.prompt_version_id);
  }

  // Collect unique prompt IDs from segments
  const uniquePromptIds = [
    ...new Set(
      segments
        .filter(
          (s): s is Extract<ComposerSegment, { type: 'prompt' }> =>
            s.type === 'prompt',
        )
        .map((s) => s.promptId),
    ),
  ];

  // Resolve prompt info for each unique prompt
  const promptInfoMap = new Map<string, PromptInfo>();
  const resolveErrors: string[] = [];

  for (const promptId of uniquePromptIds) {
    // Verify prompt exists, same org, not deleted
    const prompt = await db
      .prepare(
        'SELECT id, name FROM prompt WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
      )
      .bind(promptId, org.organizationId)
      .first<{ id: string; name: string }>();

    if (!prompt) {
      resolveErrors.push(`Prompt ${promptId} not found or not accessible`);
      continue;
    }

    // Resolve version: pinned > latest published > latest draft
    const pinnedVersionId = junctionMap.get(promptId);
    let promptVersion: PromptVersionRow | null = null;

    if (pinnedVersionId) {
      promptVersion = await db
        .prepare(
          'SELECT id, system_message, user_message, config FROM prompt_version WHERE id = ?',
        )
        .bind(pinnedVersionId)
        .first<PromptVersionRow>();
    }

    if (!promptVersion) {
      // Try latest published
      promptVersion = await db
        .prepare(
          'SELECT id, system_message, user_message, config FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
        )
        .bind(promptId)
        .first<PromptVersionRow>();
    }

    if (!promptVersion) {
      // Fall back to latest draft
      promptVersion = await db
        .prepare(
          'SELECT id, system_message, user_message, config FROM prompt_version WHERE prompt_id = ? ORDER BY created_at DESC LIMIT 1',
        )
        .bind(promptId)
        .first<PromptVersionRow>();
    }

    if (!promptVersion) {
      resolveErrors.push(
        `No version found for prompt "${prompt.name}" (${promptId})`,
      );
      continue;
    }

    // Parse model + temperature from config
    let model = 'claude-haiku-4.5';
    let temperature = 0.5;
    try {
      const config = JSON.parse(promptVersion.config || '{}');
      if (config.model) model = config.model;
      if (typeof config.temperature === 'number')
        temperature = config.temperature;
    } catch {
      // Keep defaults
    }

    promptInfoMap.set(promptId, {
      promptId,
      promptName: prompt.name,
      versionId: promptVersion.id,
      systemMessage: promptVersion.system_message ?? '',
      userMessage: promptVersion.user_message ?? '',
      model,
      temperature,
    });
  }

  // Parse inputData for variable interpolation
  let inputData: unknown = null;
  if (inputDataJson) {
    try {
      inputData = JSON.parse(inputDataJson);
    } catch {
      return data({ error: 'Invalid inputData JSON' }, { status: 400 });
    }
  }

  // Open NDJSON stream
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const writeLine = async (obj: Record<string, unknown>) => {
    await writer.write(encoder.encode(`${JSON.stringify(obj)}\n`));
  };

  const pumpStream = async () => {
    try {
      // Phase 1: Execute all prompts in parallel, collecting full outputs.
      // Nothing is streamed to the client during this phase — the UI shows "Thinking...".
      const promptOutputs = new Map<string, string>();
      const errors: Array<{ promptId: string; error: string }> = [];

      const executions = uniquePromptIds.map(async (promptId) => {
        const info = promptInfoMap.get(promptId);
        if (!info) {
          errors.push({ promptId, error: 'Failed to resolve prompt' });
          return;
        }

        try {
          const prepared = preparePrompts({
            systemMessage: info.systemMessage,
            userMessage: info.userMessage,
            inputDataJson,
            inputDataRootName,
          });

          const systemLength = prepared.systemMessage.length;
          const userLength = prepared.userMessage.length;
          const totalLength = systemLength + userLength;

          const modelResult = await resolveModelForOrg({
            db,
            organizationId: org.organizationId,
            modelId: info.model,
            encryptionKey: context.cloudflare.env.API_KEY_ENCRYPTION_KEY,
            systemAnthropicKey: context.cloudflare.env.ANTHROPIC_API_KEY,
          });

          if (!modelResult.ok) {
            errors.push({ promptId, error: modelResult.error });
            return;
          }

          const result = await generateText({
            model: modelResult.model,
            system: prepared.systemMessage,
            prompt: prepared.userMessage,
            temperature: info.temperature,
          });

          promptOutputs.set(promptId, result.text);

          // Update token counts (waitUntil — doesn't block response)
          const { usage } = result;
          if (info.versionId && usage) {
            context.cloudflare.ctx.waitUntil(
              (async () => {
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
                    info.versionId,
                  )
                  .run();
              })().catch((err) => {
                console.error('waitUntil usage error:', err);
              }),
            );
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unknown execution error';
          console.error(`Prompt execution error for ${promptId}:`, message);
          errors.push({ promptId, error: message });
        }
      });

      await Promise.all(executions);

      // Phase 2: All prompts resolved. Stream the assembled document in order.
      // Emit structure + content for each segment sequentially.
      const streamedPrompts = new Set<string>();

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (segment.type === 'static') {
          let interpolatedContent = segment.content;
          if (inputData !== null) {
            interpolatedContent = replaceVariableRefs(
              interpolatedContent,
              inputData,
              inputDataRootName,
            );
          }
          await writeLine({
            type: 'static',
            content: interpolatedContent,
            index: i,
          });
        } else {
          const info = promptInfoMap.get(segment.promptId);
          await writeLine({
            type: 'prompt_ref',
            promptId: segment.promptId,
            promptName: info?.promptName ?? segment.promptId,
            index: i,
          });

          // Stream this prompt's output (only on first occurrence — duplicates
          // share the same promptId so the client updates all matching segments)
          if (!streamedPrompts.has(segment.promptId)) {
            streamedPrompts.add(segment.promptId);
            const output = promptOutputs.get(segment.promptId);

            await writeLine({
              type: 'prompt_start',
              promptId: segment.promptId,
              promptName: info?.promptName ?? segment.promptId,
            });

            if (output) {
              // Stream in word-groups with a small delay for a natural LLM-like feel
              const words = output.split(/(?<=\s)/);
              const delay = () => new Promise<void>((r) => setTimeout(r, 20));
              for (let j = 0; j < words.length; j += 3) {
                const chunk = words.slice(j, j + 3).join('');
                await writeLine({
                  type: 'prompt_chunk',
                  promptId: segment.promptId,
                  chunk,
                });
                await delay();
              }
            }

            await writeLine({
              type: 'prompt_done',
              promptId: segment.promptId,
            });
          }
        }
      }

      const allErrors = [
        ...resolveErrors.map((e) => ({ promptId: '', error: e })),
        ...errors,
      ];

      await writeLine({ type: 'complete', errors: allErrors });
      await writer.close();
    } catch (err) {
      console.error('Composer run stream error:', err);
      try {
        await writeLine({
          type: 'complete',
          errors: [{ promptId: '', error: 'Stream failed unexpectedly' }],
        });
        await writer.close();
      } catch {
        // Writer may already be closed
      }
    }
  };

  context.cloudflare.ctx.waitUntil(pumpStream());

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
};
