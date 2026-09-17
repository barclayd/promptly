import { z } from 'zod';
import { authoringVersionSelectorSchema } from './authoring';
import { authoringStoredVersionSchema } from './authoring-history';
import {
  mcpAuthoringDependencySchema,
  mcpAuthoringDiagnosticSchema,
  mcpAuthoringMetadataSchema,
} from './mcp-authoring';

export const MCP_TESTING_LIMITS = {
  composerCalls: 8,
  comparisonCalls: 16,
  concurrency: 4,
  timeoutMs: 45_000,
  maxOutputTokens: 4096,
  defaultOutputTokens: 2048,
  outputJsonBytes: 32_768,
  assembledOutputJsonBytes: 65_536,
  staticOutputJsonBytes: 131_072,
} as const;

const modelSchema = z.string().min(1).max(200);
const testPhraseSchema = z.string().min(1).max(65_536);
const overrides = {
  model: modelSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
};
const common = {
  id: z.string().min(1).max(200),
  version: authoringVersionSelectorSchema,
  ...overrides,
  maxOutputTokens: z
    .number()
    .int()
    .min(1)
    .max(MCP_TESTING_LIMITS.maxOutputTokens)
    .optional(),
};
export const mcpTestingInputSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('supplied'),
    data: z.json(),
    rootName: z.string().max(200).nullable().optional(),
  }),
  z.strictObject({ source: z.literal('saved_sample') }),
]);
export type McpTestingInput = z.infer<typeof mcpTestingInputSchema>;
export const mcpTestPromptSchema = z.strictObject({
  ...common,
  input: mcpTestingInputSchema,
});
export const mcpTestComposerSchema = z.strictObject({
  ...common,
  input: mcpTestingInputSchema,
});
export const mcpTestSnippetSchema = z.strictObject({
  ...common,
  testPhrase: testPhraseSchema.optional(),
});
export type McpTestPromptInput = z.infer<typeof mcpTestPromptSchema>;
export type McpTestComposerInput = z.infer<typeof mcpTestComposerSchema>;
export type McpTestSnippetInput = z.infer<typeof mcpTestSnippetSchema>;
const comparison = {
  id: common.id,
  maxOutputTokens: common.maxOutputTokens,
  variants: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(100),
        version: authoringVersionSelectorSchema,
        ...overrides,
      }),
    )
    .min(2)
    .max(4)
    .refine(
      (variants) =>
        new Set(variants.map((variant) => variant.label)).size ===
        variants.length,
      'Variant labels must be unique.',
    ),
};
export const mcpCompareTestsSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('prompt'),
    ...comparison,
    input: mcpTestingInputSchema,
  }),
  z.strictObject({
    kind: z.literal('composer'),
    ...comparison,
    input: mcpTestingInputSchema,
  }),
  z.strictObject({
    kind: z.literal('snippet'),
    ...comparison,
    testPhrase: testPhraseSchema.optional(),
  }),
]);
export type McpCompareTestsInput = z.infer<typeof mcpCompareTestsSchema>;
export const mcpTestingErrorSchema = z.strictObject({
  code: z.enum([
    'invalid_input',
    'model_unavailable',
    'key_unavailable',
    'call_limit',
    'provider_error',
    'cancelled',
    'timeout',
    'access_denied',
  ]),
  message: z.string(),
  diagnostics: z.array(mcpAuthoringDiagnosticSchema),
});
export type McpTestingError = z.infer<typeof mcpTestingErrorSchema>;
export const mcpTestingUsageSchema = z.strictObject({
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  cachedInputTokens: z.number().int().nonnegative().nullable(),
  reasoningTokens: z.number().int().nonnegative().nullable(),
});
export type McpTestingUsage = z.infer<typeof mcpTestingUsageSchema>;
export const mcpTestingConfigSchema = z.strictObject({
  model: z.string(),
  provider: z.enum(['openai', 'anthropic', 'google']),
  providerModelId: z.string(),
  temperature: z.number(),
  maxOutputTokens: z.number().int(),
  modelSource: z.enum(['override', 'saved', 'default']),
  temperatureSource: z.enum(['override', 'saved', 'default']),
});
const resultBase = {
  metadata: mcpAuthoringMetadataSchema,
  version: authoringStoredVersionSchema,
  dependencies: z.array(mcpAuthoringDependencySchema),
  diagnostics: z.array(mcpAuthoringDiagnosticSchema),
  status: z.enum(['completed', 'failed']),
  output: z.string().nullable(),
  outputTruncated: z.boolean(),
  usage: mcpTestingUsageSchema,
  latencyMs: z.number().int().nonnegative(),
};
const generation = {
  ...resultBase,
  config: mcpTestingConfigSchema,
  executed: z.boolean(),
  finishReason: z.string().nullable(),
  error: mcpTestingErrorSchema.nullable(),
};
export const mcpTestPromptResultSchema = z.strictObject({
  kind: z.literal('prompt'),
  ...generation,
  inputSource: z.enum(['supplied', 'saved_sample']),
});
export const mcpTestSnippetResultSchema = z.strictObject({
  kind: z.literal('snippet'),
  ...generation,
  testPhraseSource: z.enum(['supplied', 'saved_sample']),
});
export const mcpTestComposerResultSchema = z.strictObject({
  kind: z.literal('composer'),
  ...resultBase,
  inputSource: z.enum(['supplied', 'saved_sample']),
  prompts: z.array(mcpTestPromptResultSchema),
  segments: z.array(
    z.union([
      z.strictObject({ kind: z.literal('html'), html: z.string() }),
      z.strictObject({
        kind: z.literal('prompt_output'),
        promptId: z.string(),
        resultIndex: z.number().int().nonnegative(),
      }),
    ]),
  ),
  rendering: z.string(),
});
export const mcpTestResultSchema = z.discriminatedUnion('kind', [
  mcpTestPromptResultSchema,
  mcpTestSnippetResultSchema,
  mcpTestComposerResultSchema,
]);
export type McpTestPromptResult = z.infer<typeof mcpTestPromptResultSchema>;
export type McpTestSnippetResult = z.infer<typeof mcpTestSnippetResultSchema>;
export type McpTestComposerResult = z.infer<typeof mcpTestComposerResultSchema>;
export type McpTestResult = z.infer<typeof mcpTestResultSchema>;
export const mcpCompareTestsResultSchema = z.strictObject({
  kind: z.enum(['prompt', 'snippet', 'composer']),
  id: z.string(),
  variants: z.array(
    z.strictObject({ label: z.string(), result: mcpTestResultSchema }),
  ),
  inputSource: z.enum(['supplied', 'saved_sample']),
  sampleVersionId: z.string().nullable(),
  usage: mcpTestingUsageSchema,
  latencyMs: z.number().int().nonnegative(),
});
export type McpCompareTestsResult = z.infer<typeof mcpCompareTestsResultSchema>;
