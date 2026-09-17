import type {
  McpServer,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  assertAuthoringJson,
  parseAuthoringValue,
} from '../authoring/normalize';
import {
  compareTests,
  TestingError,
  testComposer,
  testPrompt,
  testSnippet,
} from '../testing/execution.server';
import { AUTHORING_LIMITS } from '../validations/authoring';
import type { McpConnectionProps } from '../validations/mcp';
import {
  mcpCompareTestsResultSchema,
  mcpCompareTestsSchema,
  mcpTestComposerResultSchema,
  mcpTestComposerSchema,
  mcpTestPromptResultSchema,
  mcpTestPromptSchema,
  mcpTestSnippetResultSchema,
  mcpTestSnippetSchema,
} from '../validations/mcp-testing';
import { toMcpAuthoringError } from './authoring.server';
import { isMcpAuthoringEnabled } from './config.server';
import {
  authorizeMcpConnection,
  McpConnectionError,
} from './connections.server';
import { cachedMcpJsonSchema, cachedMcpSchema } from './schema.server';
import {
  getStoredMcpTest,
  type McpTestError,
  type McpTestRunOutput,
  mcpTestLookupSchema,
  mcpTestRequestKeySchema,
  mcpTestRunOutputSchema,
  runStoredMcpTest,
} from './test-runs.server';
import { recordMcpToolCall } from './usage.server';

const requestKey = { requestKey: mcpTestRequestKeySchema };
const promptInput = mcpTestPromptSchema.safeExtend(requestKey);
const snippetInput = mcpTestSnippetSchema.safeExtend(requestKey);
const composerInput = mcpTestComposerSchema.safeExtend(requestKey);
const compareInput = z.discriminatedUnion('kind', [
  mcpCompareTestsSchema.options[0].safeExtend(requestKey),
  mcpCompareTestsSchema.options[1].safeExtend(requestKey),
  mcpCompareTestsSchema.options[2].safeExtend(requestKey),
]);
const outputFor = (schema: z.ZodType) =>
  mcpTestRunOutputSchema.extend({ result: schema.optional() });
const promptOutput = outputFor(mcpTestPromptResultSchema);
const snippetOutput = outputFor(mcpTestSnippetResultSchema);
const composerOutput = outputFor(mcpTestComposerResultSchema);
const compareOutput = outputFor(mcpCompareTestsResultSchema);

const toError = (error: unknown): McpTestError =>
  error instanceof TestingError
    ? {
        code: error.code,
        message: error.message,
        diagnostics: error.diagnostics,
      }
    : toMcpAuthoringError(error).error;

const validatedInput = <Input>(
  schema: z.ZodType<Input>,
): StandardSchemaWithJSON<
  unknown,
  { success: true; data: Input } | { success: false; error: McpTestError }
> => ({
  '~standard': {
    version: 1,
    vendor: 'promptly',
    jsonSchema: {
      ...cachedMcpJsonSchema(schema),
      input: (options) => ({
        type: 'object',
        ...cachedMcpJsonSchema(schema).input(options),
      }),
    },
    validate: (value) => {
      try {
        assertAuthoringJson(value, AUTHORING_LIMITS.definitionBytes + 8192);
        return {
          value: { success: true, data: parseAuthoringValue(schema, value) },
        };
      } catch (error) {
        return { value: { success: false, error: toError(error) } };
      }
    },
  },
});

const reply = (value: Record<string, unknown>, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value,
  ...(isError ? { isError: true } : {}),
});

const hasFailed = (outcome: McpTestRunOutput) =>
  outcome.status === 'failed' ||
  outcome.result?.status === 'failed' ||
  (Array.isArray(outcome.result?.variants) &&
    outcome.result.variants.some(
      (variant) =>
        variant !== null &&
        typeof variant === 'object' &&
        'result' in variant &&
        variant.result !== null &&
        typeof variant.result === 'object' &&
        'status' in variant.result &&
        variant.result.status === 'failed',
    ));

export const registerPromptlyTesting = (
  server: McpServer,
  env: Env,
  ctx: ExecutionContext,
  props: McpConnectionProps,
) => {
  const authorize = async () => {
    if (!isMcpAuthoringEnabled(env))
      throw new McpConnectionError(
        'connection_unavailable',
        'MCP testing is currently disabled.',
        403,
      );
    const access = await authorizeMcpConnection(env.promptly, {
      ...props,
      tokenScopes: props.scopes,
      requiredScope: 'mcp:run',
    });
    if (access.workspace.organizationId !== props.organizationId)
      throw new McpConnectionError(
        'connection_unavailable',
        'The connected workspace is unavailable.',
        403,
      );
    return access;
  };
  const register = <Input extends { requestKey: string }>(options: {
    name: string;
    title: string;
    description: string;
    input: z.ZodType<Input>;
    output: z.ZodType;
    run: (
      context: Parameters<typeof testPrompt>[0],
      input: unknown,
    ) => Promise<Record<string, unknown>>;
  }) => {
    server.registerTool(
      options.name,
      {
        title: options.title,
        description: `${options.description} Requires explicit mcp:run consent and may incur charges on workspace LLM keys. Overrides apply only to this test; saved content/configuration is unchanged. Use a fresh requestKey for a new test; retry identical inputs with the same key to retrieve the recorded result without another LLM call for 24 hours. Use get_test_result if the connection is interrupted.`,
        inputSchema: validatedInput(options.input),
        outputSchema: cachedMcpSchema(options.output),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (input, context) => {
        try {
          await authorize();
          if (!input.success) return reply({ error: input.error }, true);
          const { requestKey: key, ...testInput } = input.data;
          const outcome = await runStoredMcpTest(env.promptly, {
            connectionId: props.connectionId,
            requestKey: key,
            operation: options.name,
            input: testInput,
            toError,
            run: () =>
              options.run(
                {
                  db: env.promptly,
                  organizationId: props.organizationId,
                  encryptionKey: env.API_KEY_ENCRYPTION_KEY,
                  systemAnthropicKey: env.ANTHROPIC_API_KEY,
                  signal: context.mcpReq.signal,
                  beforeGenerate: async () => {
                    await authorize();
                  },
                },
                testInput,
              ),
          });
          await authorize();
          return reply(outcome, hasFailed(outcome));
        } catch (error) {
          return reply({ error: toError(error) }, true);
        } finally {
          ctx.waitUntil(
            recordMcpToolCall(
              env.promptly,
              props.organizationId,
              options.name,
            ).catch(() => {
              console.warn('MCP test usage recording failed', {
                toolName: options.name,
              });
            }),
          );
        }
      },
    );
  };
  register({
    name: 'test_prompt',
    title: 'Test a prompt',
    description:
      'Execute one explicitly selected prompt version with supplied or saved sample input data. Optionally override model, temperature and output token limit. Preserves ordered snippet dependencies and returns the resolved version, output, token usage and latency. Use list_models and list_versions to discover available choices.',
    input: promptInput,
    output: promptOutput,
    run: testPrompt,
  });
  register({
    name: 'test_snippet',
    title: 'Test a snippet',
    description:
      'Use the selected snippet version as the system instructions and testPhrase as the user message. Omitted testPhrase/model use the selected version’s saved testing configuration. Optionally override temperature and output token limit.',
    input: snippetInput,
    output: snippetOutput,
    run: testSnippet,
  });
  register({
    name: 'test_composer',
    title: 'Test a composer',
    description:
      'Execute the selected composer version using supplied or saved sample input data. Honors pinned prompt versions and their snippet dependencies, executes each unique prompt once, and assembles the output in document order. Model/temperature overrides apply to all referenced prompts; omission retains each prompt’s saved configuration. Returns per-prompt usage, errors and resolved versions. At most eight unique prompts per composer test.',
    input: composerInput,
    output: composerOutput,
    run: testComposer,
  });
  register({
    name: 'compare_tests',
    title: 'Compare versions and model configurations',
    description:
      'Compare two to four labeled variants of the same prompt, snippet or composer using identical common input data/test phrase, with explicit versions and optional per-variant model/temperature overrides. Returns ordered results with output, resolved configuration, usage and latency. Saved sample input is taken once from the first variant. At most sixteen LLM calls across the comparison.',
    input: compareInput,
    output: compareOutput,
    run: compareTests,
  });
  server.registerTool(
    'get_test_result',
    {
      title: 'Get a previous test result',
      description:
        'Retrieve a test or comparison result using its requestKey on this same MCP connection. Makes no provider calls. Results are retained for 24 hours. A running or uncertain result must not be automatically restarted with a new key, because it may already have incurred charges.',
      inputSchema: cachedMcpSchema(mcpTestLookupSchema),
      outputSchema: cachedMcpSchema(mcpTestRunOutputSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ requestKey }) => {
      try {
        await authorize();
        const result = await getStoredMcpTest(
          env.promptly,
          props.connectionId,
          requestKey,
        );
        await authorize();
        return reply(result, hasFailed(result));
      } catch (error) {
        return reply({ error: toError(error) }, true);
      }
    },
  );
};
