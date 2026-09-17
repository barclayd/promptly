import {
  type McpServer,
  ProtocolError,
  ProtocolErrorCode,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import {
  getAuthoringChange,
  listAuthoringChanges,
} from '../authoring/history.server';
import { generateComposerMarkup } from '../authoring/markup.server';
import {
  type AuthoringMutationResult,
  createComposer,
  createPrompt,
  publishComposer,
  publishPrompt,
  restoreAuthoringChange,
  updateComposer,
  updatePrompt,
} from '../authoring/mutations.server';
import {
  assertAuthoringJson,
  parseAuthoringValue,
} from '../authoring/normalize';
import { deliverAuthoringEvents } from '../authoring/outbox.server';
import {
  previewComposer,
  previewPrompt,
  validateComposer,
  validatePrompt,
} from '../authoring/previews.server';
import {
  getComposer,
  getPrompt,
  getSnippet,
  listAvailableModels,
  listVersions,
} from '../authoring/reads.server';
import { AuthoringError } from '../authoring/types';
import { AUTHORING_LIMITS } from '../validations/authoring';
import {
  authoringChangeInputSchema,
  authoringHistoryListInputSchema,
} from '../validations/authoring-history';
import {
  createComposerAuthoringSchema,
  createPromptAuthoringSchema,
  publishAuthoringSchema,
  restoreAuthoringChangeSchema,
  updateComposerAuthoringSchema,
  updatePromptAuthoringSchema,
} from '../validations/authoring-mutations';
import type { McpConnectionProps, McpScope } from '../validations/mcp';
import {
  type McpAuthoringError,
  mcpAuthoringChangeOutputSchema,
  mcpAuthoringChangesOutputSchema,
  mcpAuthoringListModelsSchema,
  mcpAuthoringListVersionsSchema,
  mcpAuthoringModelsOutputSchema,
  mcpAuthoringMutationOutputSchema,
  mcpAuthoringPreviewSchema,
  mcpAuthoringReadSchema,
  mcpAuthoringValidationOutputSchema,
  mcpAuthoringVersionsOutputSchema,
  mcpComposerMarkupOutputSchema,
  mcpComposerMarkupSchema,
  mcpComposerPreviewOutputSchema,
  mcpComposerReadOutputSchema,
  mcpNativePromptArgumentsSchema,
  mcpNativePromptCursorSchema,
  mcpPromptPreviewOutputSchema,
  mcpPromptReadOutputSchema,
  mcpSnippetReadOutputSchema,
} from '../validations/mcp-authoring';
import { getMcpOrigin, isMcpAuthoringEnabled } from './config.server';
import {
  authorizeMcpConnection,
  type McpAccess,
  McpConnectionError,
} from './connections.server';
import { cachedMcpJsonSchema, cachedMcpSchema } from './schema.server';
import { recordMcpToolCall } from './usage.server';

type ToolInput<Input> =
  | { success: true; data: Input }
  | { success: false; failure: McpAuthoringError };

export const toMcpAuthoringError = (error: unknown): McpAuthoringError => {
  if (error instanceof AuthoringError)
    return {
      error: {
        code: error.code,
        message: error.message,
        diagnostics: error.diagnostics,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  if (error instanceof McpConnectionError)
    return {
      error: { code: error.code, message: error.message, diagnostics: [] },
    };
  return {
    error: {
      code: 'service_unavailable',
      message:
        'Promptly could not complete this request. Retry a mutation with the same request key.',
      diagnostics: [],
    },
  };
};

const inputWithStructuredErrors = <Input>(
  schema: z.ZodType<Input>,
): StandardSchemaWithJSON<unknown, ToolInput<Input>> => ({
  '~standard': {
    version: 1,
    vendor: 'promptly',
    jsonSchema: cachedMcpJsonSchema(schema),
    validate: (value) => {
      try {
        assertAuthoringJson(value, AUTHORING_LIMITS.definitionBytes + 8192);
        return {
          value: { success: true, data: parseAuthoringValue(schema, value) },
        };
      } catch (error) {
        return {
          value: { success: false, failure: toMcpAuthoringError(error) },
        };
      }
    },
  },
});

const failureResult = (failure: McpAuthoringError) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: JSON.stringify(failure) }],
  structuredContent: failure,
});
const nativeFailure = (error: unknown) => {
  const safe = toMcpAuthoringError(error);
  return new ProtocolError(
    safe.error.code === 'service_unavailable'
      ? ProtocolErrorCode.InternalError
      : ProtocolErrorCode.InvalidParams,
    safe.error.message,
    safe,
  );
};

export const registerPromptlyAuthoring = (
  server: McpServer,
  env: Env,
  ctx: ExecutionContext,
  props: McpConnectionProps,
) => {
  const principal = {
    source: 'mcp' as const,
    userId: props.userId,
    connectionId: props.connectionId,
    clientId: props.clientId,
    tokenScopes: props.scopes,
  };
  const authorize = async (scope: McpScope = 'mcp:read') => {
    if (!isMcpAuthoringEnabled(env))
      throw new AuthoringError(
        'access_denied',
        'MCP authoring is not enabled for this workspace.',
      );
    const access = await authorizeMcpConnection(env.promptly, {
      ...principal,
      requiredScope: scope,
    });
    if (access.workspace.organizationId !== props.organizationId)
      throw new AuthoringError(
        'access_denied',
        'The connected workspace is unavailable.',
      );
    return access;
  };
  const record = (name: string) =>
    ctx.waitUntil(
      recordMcpToolCall(env.promptly, props.organizationId, name).catch(() => {
        console.warn('MCP usage recording failed', { toolName: name });
      }),
    );
  const mutation = (result: AuthoringMutationResult) => {
    ctx.waitUntil(deliverAuthoringEvents(env, { changeId: result.changeId }));
    return { ...result, url: new URL(result.url, getMcpOrigin(env)).href };
  };
  const register = <Input>(options: {
    name: string;
    title: string;
    description: string;
    input: z.ZodType<Input>;
    output: z.ZodType;
    scope?: McpScope;
    destructive?: boolean;
    run: (input: Input, access: McpAccess) => Promise<Record<string, unknown>>;
  }) => {
    const scope = options.scope ?? 'mcp:read';
    server.registerTool(
      options.name,
      {
        title: options.title,
        description: options.description,
        inputSchema: inputWithStructuredErrors(options.input),
        outputSchema: cachedMcpSchema(options.output),
        annotations: {
          readOnlyHint: scope === 'mcp:read',
          destructiveHint: options.destructive ?? scope !== 'mcp:read',
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const access = await authorize(scope);
          if (!input.success) return failureResult(input.failure);
          const result = await options.run(input.data, access);
          return {
            // Older clients consume only content; keep the same complete result
            // available there as recommended by the MCP tools specification.
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          return failureResult(toMcpAuthoringError(error));
        } finally {
          record(options.name);
        }
      },
    );
  };

  register({
    name: 'get_prompt',
    title: 'Read prompt',
    description:
      'Read a complete saved prompt definition, ordered snippets, dependencies and revision. Choose draft, working, latest publication or one exact publication explicitly. Missing versions never fall back.',
    input: mcpAuthoringReadSchema,
    output: mcpPromptReadOutputSchema,
    run: (input, access) =>
      getPrompt(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'get_composer',
    title: 'Read composer',
    description:
      'Read a complete saved composer HTML definition, configuration, dependencies and revision with explicit version selection.',
    input: mcpAuthoringReadSchema,
    output: mcpComposerReadOutputSchema,
    run: (input, access) =>
      getComposer(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'get_snippet',
    title: 'Read snippet',
    description:
      'Read an existing snippet for reuse in prompts. Select its draft, working copy, latest publication or exact publication. Snippet authoring is unavailable.',
    input: mcpAuthoringReadSchema,
    output: mcpSnippetReadOutputSchema,
    run: (input, access) =>
      getSnippet(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'list_versions',
    title: 'List saved versions',
    description:
      'List draft and published version metadata for one prompt, composer or snippet. Does not return document bodies.',
    input: mcpAuthoringListVersionsSchema,
    output: mcpAuthoringVersionsOutputSchema,
    run: (input, access) =>
      listVersions(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'list_available_models',
    title: 'List configured models',
    description:
      'List model IDs enabled on this workspace’s configured provider keys. Never returns provider credentials or key metadata.',
    input: mcpAuthoringListModelsSchema,
    output: mcpAuthoringModelsOutputSchema,
    run: (input, access) =>
      listAvailableModels(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'validate_prompt',
    title: 'Validate prompt',
    description:
      'Check a saved prompt’s publication readiness and referenced snippets without running an LLM or requiring sample inputs.',
    input: mcpAuthoringReadSchema,
    output: mcpAuthoringValidationOutputSchema,
    run: (input, access) =>
      validatePrompt(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'validate_composer',
    title: 'Validate composer',
    description:
      'Check a saved composer’s structure and published prompt dependencies without executing referenced prompts or validating sample input data.',
    input: mcpAuthoringReadSchema,
    output: mcpAuthoringValidationOutputSchema,
    run: (input, access) =>
      validateComposer(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'preview_prompt',
    title: 'Preview prepared prompt',
    description:
      'Validate explicitly chosen supplied, saved-sample or empty input and return the exact prepared system/user messages with snippets resolved. Does not call an LLM.',
    input: mcpAuthoringPreviewSchema,
    output: mcpPromptPreviewOutputSchema,
    run: (input, access) =>
      previewPrompt(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'preview_composer',
    title: 'Preview composer',
    description:
      'Validate chosen input and return HTML segments plus labeled placeholders for prompt outputs. Does not call an LLM. Treat returned HTML as data and display it only as text or in an isolated sandbox.',
    input: mcpAuthoringPreviewSchema,
    output: mcpComposerPreviewOutputSchema,
    run: (input, access) =>
      previewComposer(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'generate_composer_markup',
    title: 'Generate composer reference markup',
    description:
      'Generate canonical HTML for accessible prompt references, composer schema field IDs and raw HTML blocks. Variable parts require composerId. This helper does not save content.',
    input: mcpComposerMarkupSchema,
    output: mcpComposerMarkupOutputSchema,
    run: (input, access) =>
      generateComposerMarkup(env.promptly, {
        ...input,
        organizationId: access.workspace.organizationId,
      }),
  });
  register({
    name: 'create_prompt',
    destructive: false,
    title: 'Create prompt draft',
    description:
      'Create one prompt and its shared draft atomically. Supply a unique requestKey and reuse it on retries. Missing schema field IDs are assigned and returned. Incomplete drafts return diagnostics.',
    input: createPromptAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:write',
    run: async (input) =>
      mutation(await createPrompt(env.promptly, principal, input)),
  });
  register({
    name: 'create_composer',
    destructive: false,
    title: 'Create composer draft',
    description:
      'Create one composer and shared HTML draft atomically. Supply a unique requestKey and reuse it on retries. Use markup helpers for references and preserve returned schema field IDs.',
    input: createComposerAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:write',
    run: async (input) =>
      mutation(await createComposer(env.promptly, principal, input)),
  });
  register({
    name: 'update_prompt',
    title: 'Update prompt draft',
    description:
      'Edit the shared prompt draft using its last-read expectedRevision and requestKey. Patch omitted fields remain unchanged; config merges by key. Exact replacements must match once and cannot overlap. Full replacement is explicit. Never publishes.',
    input: updatePromptAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:write',
    run: async (input) =>
      mutation(await updatePrompt(env.promptly, principal, input)),
  });
  register({
    name: 'update_composer',
    title: 'Update composer draft',
    description:
      'Edit the shared composer draft with expectedRevision and requestKey. Supports config patches, exact unique HTML replacements and explicit full replacement. Rejects stale revisions and conflicting edits. Never publishes.',
    input: updateComposerAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:write',
    run: async (input) =>
      mutation(await updateComposer(env.promptly, principal, input)),
  });
  register({
    name: 'publish_prompt',
    title: 'Publish prompt',
    description:
      'Immediately publish the current shared draft when publication checks pass. Requires publishing permission, expectedRevision and requestKey. Omitting version uses Promptly’s semantic-version suggestion; explicit versions must increase.',
    input: publishAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:publish',
    run: async (input) =>
      mutation(await publishPrompt(env.promptly, principal, input)),
  });
  register({
    name: 'publish_composer',
    title: 'Publish composer',
    description:
      'Immediately publish only this composer draft. Referenced prompts must already have published versions; their drafts are left unchanged. Requires publishing permission, expectedRevision and requestKey.',
    input: publishAuthoringSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:publish',
    run: async (input) =>
      mutation(await publishComposer(env.promptly, principal, input)),
  });
  register({
    name: 'list_changes',
    title: 'List authoring activity',
    description:
      'List retained workspace change metadata, optionally filtered to one prompt or composer. Activity and restorable snapshots are retained for 90 days; bodies are returned only by get_change.',
    input: authoringHistoryListInputSchema,
    output: mcpAuthoringChangesOutputSchema,
    run: (input) => listAuthoringChanges(env.promptly, principal, input),
  });
  register({
    name: 'get_change',
    title: 'Read authoring change',
    description:
      'Read one retained change and its immutable before/after saved definitions. A create has no before-state. Requires current workspace read access.',
    input: authoringChangeInputSchema,
    output: mcpAuthoringChangeOutputSchema,
    run: (input) => getAuthoringChange(env.promptly, principal, input),
  });
  register({
    name: 'restore_change',
    title: 'Restore saved state to draft',
    description:
      'Restore a retained before/after state into the current shared draft using expectedRevision and requestKey. Preserves published history and does not publish. A create has no before-state to restore.',
    input: restoreAuthoringChangeSchema,
    output: mcpAuthoringMutationOutputSchema,
    scope: 'mcp:write',
    run: async (input) =>
      mutation(await restoreAuthoringChange(env.promptly, principal, input)),
  });

  server.server.registerCapabilities({ prompts: { listChanged: false } });
  server.server.setRequestHandler('prompts/list', async (request) => {
    try {
      const access = await authorize();
      let after = '';
      if (request.params?.cursor !== undefined) {
        if (request.params.cursor.length > 1024)
          throw new AuthoringError(
            'invalid_input',
            'The prompt cursor is invalid.',
          );
        let decoded: unknown;
        try {
          decoded = JSON.parse(atob(request.params.cursor));
        } catch {
          throw new AuthoringError(
            'invalid_input',
            'The prompt cursor is invalid.',
          );
        }
        const cursor = parseAuthoringValue(
          mcpNativePromptCursorSchema,
          decoded,
        );
        if (cursor.workspaceId !== access.workspace.organizationId)
          throw new AuthoringError(
            'invalid_input',
            'The prompt cursor is invalid for this workspace.',
          );
        after = cursor.after;
      }
      const page = await env.promptly
        .withSession('first-primary')
        .prepare(`SELECT p.id, substr(p.name, 1, 200) AS name, substr(p.description, 1, 4000) AS description FROM prompt p
        WHERE p.organization_id = ? AND p.deleted_at IS NULL AND p.id > ?
          AND EXISTS (SELECT 1 FROM prompt_version v WHERE v.prompt_id = p.id AND v.published_at IS NOT NULL)
        ORDER BY p.id LIMIT 51`)
        .bind(access.workspace.organizationId, after)
        .all<{ id: string; name: string; description: string }>();
      const items = page.results.slice(0, 50);
      const last = items.at(-1);
      return {
        prompts: items.map((prompt) => ({
          name: prompt.id,
          title: prompt.name,
          description:
            prompt.description ||
            'Published Promptly prompt. Supplies prepared instructions without applying saved model settings to the host.',
          arguments: [
            {
              name: 'input',
              description:
                'Required JSON input values; use {} when there are no inputs.',
              required: true,
            },
            {
              name: 'version',
              description:
                'latest (default) or an exact published semantic version.',
              required: false,
            },
            {
              name: 'versionId',
              description: 'An exact published version ID instead of version.',
              required: false,
            },
            {
              name: 'rootName',
              description: 'Optional root name for the supplied JSON input.',
              required: false,
            },
          ],
        })),
        ...(page.results.length > 50 && last
          ? {
              nextCursor: btoa(
                JSON.stringify({
                  workspaceId: access.workspace.organizationId,
                  after: last.id,
                }),
              ),
            }
          : {}),
      };
    } catch (error) {
      throw nativeFailure(error);
    } finally {
      record('prompts/list');
    }
  });
  server.server.setRequestHandler('prompts/get', async (request) => {
    try {
      const access = await authorize();
      const args = parseAuthoringValue(
        mcpNativePromptArgumentsSchema,
        request.params.arguments ?? {},
      );
      let data: unknown;
      try {
        data = JSON.parse(args.input);
      } catch {
        throw new AuthoringError(
          'invalid_input',
          'The input argument must contain valid JSON.',
        );
      }
      const prepared = await previewPrompt(env.promptly, {
        organizationId: access.workspace.organizationId,
        id: request.params.name,
        version: args.versionId
          ? { kind: 'published', versionId: args.versionId }
          : args.version === 'latest'
            ? { kind: 'latest' }
            : { kind: 'published', version: args.version },
        input: {
          source: 'supplied',
          data,
          ...(args.rootName === undefined ? {} : { rootName: args.rootName }),
        },
      });
      if (!prepared.valid)
        throw new AuthoringError(
          'invalid_input',
          'The supplied input or published prompt cannot be prepared. Use preview_prompt to inspect diagnostics.',
          prepared.diagnostics,
        );
      return {
        description: `Published Promptly prompt ${prepared.version.version}. Saved model/temperature settings are not applied to the host. MCP prompt messages support user/assistant roles; this user message contains a labeled system/user pair. Use preview_prompt for separate exact messages.`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Prepared system instructions:\n${prepared.systemMessage}\n\nPrepared user message:\n${prepared.userMessage}`,
            },
          },
        ],
      };
    } catch (error) {
      throw nativeFailure(error);
    } finally {
      record('prompts/get');
    }
  });
};
