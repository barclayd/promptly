import {
  type CallWarning,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
} from 'ai';
import type { z } from 'zod';
import {
  AUTHORING_DEPENDENCY_MAX_BYTES,
  loadAuthoringSnippetContents,
} from '../authoring/dependencies.server';
import {
  assertAuthoringJson,
  parseAuthoringValue,
} from '../authoring/normalize';
import {
  prepareComposerPreview,
  preparePromptPreview,
} from '../authoring/preview';
import { getComposer, getPrompt, getSnippet } from '../authoring/reads.server';
import type {
  AuthoringDiagnostic,
  AuthoringReadResult,
} from '../authoring/types';
import { getModelPricing } from '../model-pricing';
import { resolveModelForOrg } from '../resolve-model.server';
import type { AuthoringVersionSelector } from '../validations/authoring';
import {
  MCP_TESTING_LIMITS,
  type McpCompareTestsResult,
  type McpTestComposerInput,
  type McpTestComposerResult,
  type McpTestingError,
  type McpTestingInput,
  type McpTestingUsage,
  type McpTestPromptInput,
  type McpTestPromptResult,
  type McpTestResult,
  type McpTestSnippetInput,
  type McpTestSnippetResult,
  mcpCompareTestsSchema,
  mcpTestComposerSchema,
  type mcpTestingConfigSchema,
  mcpTestPromptSchema,
  mcpTestSnippetSchema,
} from '../validations/mcp-testing';

export class TestingError extends Error {
  constructor(
    public readonly code: McpTestingError['code'],
    message: string,
    public readonly diagnostics: AuthoringDiagnostic[] = [],
  ) {
    super(message);
    this.name = 'TestingError';
  }
}

type GenerateOptions = {
  model: LanguageModel;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  maxRetries: 0;
  abortSignal: AbortSignal;
};
type GenerateResult = {
  text: string;
  usage: LanguageModelUsage;
  finishReason: string;
  response: { modelId: string };
  warnings?: CallWarning[];
};
export type TestingContext = {
  db: D1Database;
  organizationId: string;
  encryptionKey?: string;
  systemAnthropicKey?: string;
  signal?: AbortSignal;
  beforeGenerate?: () => Promise<void>;
  resolveModel?: typeof resolveModelForOrg;
  generate?: (options: GenerateOptions) => Promise<GenerateResult>;
};
type Overrides = {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};
type SelectedInput = {
  source: 'supplied';
  data: z.infer<ReturnType<typeof z.json>>;
  rootName?: string | null;
};
type PreparedGeneration = {
  kind: 'prompt' | 'snippet';
  read: AuthoringReadResult<unknown>;
  model: LanguageModel;
  config: z.infer<typeof mcpTestingConfigSchema>;
  system: string;
  prompt: string;
  source: 'supplied' | 'saved_sample';
};
type PreparedComposer = {
  kind: 'composer';
  read: Awaited<ReturnType<typeof getComposer>>;
  preview: ReturnType<typeof prepareComposerPreview>;
  prompts: PreparedGeneration[];
  source: 'supplied' | 'saved_sample';
};
type PreparedTest = PreparedGeneration | PreparedComposer;
const DEFAULT_MODEL = 'claude-haiku-4.5';
const EMPTY_USAGE: McpTestingUsage = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  cachedInputTokens: null,
  reasoningTokens: null,
};
const assertReady = (diagnostics: AuthoringDiagnostic[]) => {
  if (diagnostics.some((entry) => entry.severity === 'error'))
    throw new TestingError(
      'invalid_input',
      'Resolve the definition and input diagnostics before running this test.',
      diagnostics,
    );
};
const selectInput = (
  config: {
    inputData: SelectedInput['data'];
    inputDataRootName: string | null;
  },
  input: McpTestingInput,
): SelectedInput =>
  input.source === 'saved_sample'
    ? {
        source: 'supplied',
        data: config.inputData,
        rootName: config.inputDataRootName,
      }
    : input;

const resolveConfiguration = async (
  context: TestingContext,
  saved: { model?: unknown; temperature?: unknown },
  overrides: Overrides,
  defaultTemperature: number,
) => {
  const savedModel =
    typeof saved.model === 'string' && saved.model ? saved.model : undefined;
  const modelId = overrides.model ?? savedModel ?? DEFAULT_MODEL;
  const pricing = getModelPricing(modelId);
  if (!pricing)
    throw new TestingError(
      'model_unavailable',
      'The selected model is not supported. Choose a model from the workspace model list.',
    );
  const savedTemperature =
    typeof saved.temperature === 'number' &&
    Number.isFinite(saved.temperature) &&
    saved.temperature >= 0 &&
    saved.temperature <= 2
      ? saved.temperature
      : undefined;
  const resolved = await (context.resolveModel ?? resolveModelForOrg)({
    db: context.db,
    organizationId: context.organizationId,
    modelId,
    encryptionKey: context.encryptionKey,
    // The shared UI resolver falls back to Haiku for any model. Tests must honor the selected model.
    systemAnthropicKey:
      modelId === DEFAULT_MODEL ? context.systemAnthropicKey : undefined,
  });
  if (!resolved.ok)
    throw new TestingError(
      'key_unavailable',
      'A usable API key is required for the selected model. Check the workspace LLM API key settings.',
    );
  const config: PreparedGeneration['config'] = {
    model: modelId,
    provider: pricing.provider,
    providerModelId:
      typeof resolved.model === 'string'
        ? resolved.model
        : resolved.model.modelId,
    temperature:
      overrides.temperature ?? savedTemperature ?? defaultTemperature,
    maxOutputTokens:
      overrides.maxOutputTokens ?? MCP_TESTING_LIMITS.defaultOutputTokens,
    modelSource:
      overrides.model !== undefined
        ? 'override'
        : savedModel
          ? 'saved'
          : 'default',
    temperatureSource:
      overrides.temperature !== undefined
        ? 'override'
        : savedTemperature !== undefined
          ? 'saved'
          : 'default',
  };
  return { model: resolved.model, config };
};

const preparePrompt = async (
  context: TestingContext,
  input: McpTestPromptInput,
): Promise<PreparedGeneration> => {
  const read = await getPrompt(context.db, {
    organizationId: context.organizationId,
    id: input.id,
    version: input.version,
  });
  assertReady(read.diagnostics);
  const snippets = await loadAuthoringSnippetContents(
    context.db,
    context.organizationId,
    read.dependencies,
  );
  const preview = preparePromptPreview(read.definition, input.input, snippets);
  assertReady(preview.diagnostics);
  const resolved = await resolveConfiguration(
    context,
    read.definition.config,
    input,
    0.5,
  );
  return {
    kind: 'prompt',
    read: {
      ...read,
      diagnostics: [...read.diagnostics, ...preview.diagnostics],
    },
    ...resolved,
    system: preview.systemMessage,
    prompt: preview.userMessage,
    source: input.input.source,
  };
};
const prepareSnippet = async (
  context: TestingContext,
  input: McpTestSnippetInput,
): Promise<PreparedGeneration> => {
  const read = await getSnippet(context.db, {
    organizationId: context.organizationId,
    id: input.id,
    version: input.version,
  });
  assertReady(read.diagnostics);
  const phrase = input.testPhrase ?? read.definition.config.testUserMessage;
  if (!phrase.trim())
    throw new TestingError(
      'invalid_input',
      'Supply a non-empty testPhrase or save a test phrase on the selected snippet version.',
    );
  assertAuthoringJson(phrase, 262_144);
  const resolved = await resolveConfiguration(
    context,
    read.definition.config,
    input,
    0,
  );
  return {
    kind: 'snippet',
    read,
    ...resolved,
    system: read.definition.content,
    prompt: phrase,
    source: input.testPhrase === undefined ? 'saved_sample' : 'supplied',
  };
};
const prepareComposer = async (
  context: TestingContext,
  input: McpTestComposerInput,
): Promise<PreparedComposer> => {
  const read = await getComposer(context.db, {
    organizationId: context.organizationId,
    id: input.id,
    version: input.version,
  });
  const canUseDrafts = read.version.status === 'draft';
  read.diagnostics = read.diagnostics.filter(
    (entry) => !(canUseDrafts && entry.code === 'missing_published_dependency'),
  );
  assertReady(read.diagnostics);
  if (read.dependencies.length > MCP_TESTING_LIMITS.composerCalls)
    throw new TestingError(
      'call_limit',
      'A composer test can execute at most 8 unique prompts.',
    );
  const budget = { bytes: 0, references: 0 };
  const dependencies = [];
  for (const dependency of read.dependencies) {
    const selector: AuthoringVersionSelector = dependency.resolvedVersionId
      ? { kind: 'published', versionId: dependency.resolvedVersionId }
      : canUseDrafts && dependency.pinnedVersionId === null
        ? { kind: 'working' }
        : { kind: 'latest' };
    const promptRead = await getPrompt(context.db, {
      organizationId: context.organizationId,
      id: dependency.id,
      version: selector,
    });
    assertReady(promptRead.diagnostics);
    budget.bytes += new TextEncoder().encode(
      JSON.stringify(promptRead.definition),
    ).length;
    if (budget.bytes > AUTHORING_DEPENDENCY_MAX_BYTES)
      throw new TestingError(
        'call_limit',
        'Resolved composer definitions exceed the 2 MiB execution limit.',
      );
    const snippets = await loadAuthoringSnippetContents(
      context.db,
      context.organizationId,
      promptRead.dependencies,
      budget,
    );
    dependency.resolvedVersionId = promptRead.version.id;
    dependency.resolvedVersion = promptRead.version.version;
    dependencies.push({
      promptId: dependency.id,
      definition: promptRead.definition,
      read: promptRead,
      snippets,
    });
  }
  const preview = prepareComposerPreview(
    read.definition,
    input.input,
    dependencies,
  );
  assertReady(preview.diagnostics);
  const selectedInput = selectInput(read.definition.config, input.input);
  const prompts: PreparedGeneration[] = [];
  for (const dependency of dependencies) {
    const promptPreview = preparePromptPreview(
      dependency.definition,
      selectedInput,
      dependency.snippets,
    );
    assertReady(promptPreview.diagnostics);
    const resolved = await resolveConfiguration(
      context,
      dependency.definition.config,
      input,
      0.5,
    );
    prompts.push({
      kind: 'prompt',
      read: {
        ...dependency.read,
        diagnostics: [
          ...dependency.read.diagnostics,
          ...promptPreview.diagnostics,
        ],
      },
      ...resolved,
      system: promptPreview.systemMessage,
      prompt: promptPreview.userMessage,
      source: input.input.source,
    });
  }
  return {
    kind: 'composer',
    read,
    preview,
    prompts,
    source: input.input.source,
  };
};

const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;
const truncateOutput = (text: string, maximum: number) => {
  if (jsonBytes(text) <= maximum)
    return { output: text, outputTruncated: false };
  let lower = 0;
  let upper = text.length;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (jsonBytes(text.slice(0, middle)) <= maximum) lower = middle;
    else upper = middle - 1;
  }
  if (lower && /[\uD800-\uDBFF]/.test(text[lower - 1])) lower--;
  return { output: text.slice(0, lower), outputTruncated: true };
};
const usageOf = (usage: LanguageModelUsage): McpTestingUsage => ({
  inputTokens: usage.inputTokens ?? null,
  outputTokens: usage.outputTokens ?? null,
  totalTokens: usage.totalTokens ?? null,
  cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
  reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? null,
});
const sumUsage = (usages: McpTestingUsage[]): McpTestingUsage => {
  const sum = (key: keyof McpTestingUsage) =>
    usages.some((usage) => usage[key] === null)
      ? null
      : usages.reduce((total, usage) => total + (usage[key] ?? 0), 0);
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    totalTokens: sum('totalTokens'),
    cachedInputTokens: sum('cachedInputTokens'),
    reasoningTokens: sum('reasoningTokens'),
  };
};
const errorValue = (error: TestingError): McpTestingError => ({
  code: error.code,
  message: error.message,
  diagnostics: error.diagnostics,
});
const abortError = (signal: AbortSignal) =>
  new TestingError(
    signal.reason instanceof DOMException &&
      signal.reason.name === 'TimeoutError'
      ? 'timeout'
      : 'cancelled',
    signal.reason instanceof DOMException &&
      signal.reason.name === 'TimeoutError'
      ? 'The test exceeded its 45 second time limit. Usage may be unavailable for interrupted provider requests.'
      : 'The test was cancelled. Usage may be unavailable for interrupted provider requests.',
  );
const cancellable = async <T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  if (signal.aborted) throw abortError(signal);
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([operation(), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
};
const runGeneration = async (
  context: TestingContext,
  prepared: PreparedGeneration,
  signal: AbortSignal,
): Promise<McpTestPromptResult | McpTestSnippetResult> => {
  const started = Date.now();
  let executed = false;
  const base = {
    metadata: prepared.read.metadata,
    version: prepared.read.version,
    dependencies: prepared.read.dependencies,
    diagnostics: prepared.read.diagnostics,
    config: prepared.config,
  };
  const identity =
    prepared.kind === 'prompt'
      ? { kind: 'prompt' as const, inputSource: prepared.source }
      : { kind: 'snippet' as const, testPhraseSource: prepared.source };
  try {
    if (signal.aborted) throw abortError(signal);
    if (context.beforeGenerate) {
      try {
        await cancellable(context.beforeGenerate, signal);
      } catch (error) {
        if (signal.aborted) throw abortError(signal);
        if (error instanceof TestingError) throw error;
        throw new TestingError(
          'access_denied',
          'Testing access changed. Reconnect with permission to run tests.',
        );
      }
    }
    if (signal.aborted) throw abortError(signal);
    executed = true;
    const result = await cancellable(
      () =>
        (context.generate ?? generateText)({
          model: prepared.model,
          system: prepared.system,
          prompt: prepared.prompt,
          temperature: prepared.config.temperature,
          maxOutputTokens: prepared.config.maxOutputTokens,
          maxRetries: 0,
          abortSignal: signal,
        }),
      signal,
    );
    const ignoredSettings = ['temperature', 'maxOutputTokens'].filter(
      (setting) =>
        result.warnings?.some(
          (warning) =>
            warning.type === 'unsupported' && warning.feature === setting,
        ),
    );
    return {
      ...base,
      ...identity,
      diagnostics: [
        ...base.diagnostics,
        ...ignoredSettings.map(
          (setting): AuthoringDiagnostic => ({
            code: 'unsupported_model_setting',
            severity: 'warning',
            path: ['config', setting],
            message: `The selected provider does not support ${setting}; the requested value may be ignored.`,
          }),
        ),
      ],
      config: { ...prepared.config, providerModelId: result.response.modelId },
      status: 'completed',
      executed,
      ...truncateOutput(result.text, MCP_TESTING_LIMITS.outputJsonBytes),
      finishReason: result.finishReason,
      usage: usageOf(result.usage),
      latencyMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    const safeError = signal.aborted
      ? abortError(signal)
      : error instanceof TestingError
        ? error
        : new TestingError(
            'provider_error',
            'The model provider could not complete this test. Check the model and workspace API key settings before trying a new request.',
          );
    return {
      ...base,
      ...identity,
      status: 'failed',
      executed,
      output: null,
      outputTruncated: false,
      finishReason: null,
      usage: { ...EMPTY_USAGE },
      latencyMs: Date.now() - started,
      error: errorValue(safeError),
    };
  }
};
const callsOf = (prepared: PreparedTest) =>
  prepared.kind === 'composer' ? prepared.prompts : [prepared];
const executePrepared = async (
  context: TestingContext,
  prepared: PreparedTest[],
  signal: AbortSignal,
): Promise<McpTestResult[]> => {
  const calls = prepared.flatMap(callsOf);
  if (calls.length > MCP_TESTING_LIMITS.comparisonCalls)
    throw new TestingError(
      'call_limit',
      'A comparison can execute at most 16 model calls.',
    );
  const describe = (test: PreparedGeneration) => ({
    kind: test.kind,
    metadata: test.read.metadata,
    version: test.read.version,
    dependencies: test.read.dependencies,
    diagnostics: test.read.diagnostics,
    config: test.config,
  });
  const staticOutput = prepared.map((test) =>
    test.kind === 'composer'
      ? {
          kind: test.kind,
          metadata: test.read.metadata,
          version: test.read.version,
          dependencies: test.read.dependencies,
          diagnostics: [...test.read.diagnostics, ...test.preview.diagnostics],
          segments: test.preview.segments,
          rendering: test.preview.rendering,
          prompts: test.prompts.map(describe),
        }
      : describe(test),
  );
  if (jsonBytes(staticOutput) > MCP_TESTING_LIMITS.staticOutputJsonBytes)
    throw new TestingError(
      'call_limit',
      'The resolved test output structure exceeds 128 KiB. Compare fewer variants or use a smaller composer.',
    );
  const results: (McpTestPromptResult | McpTestSnippetResult)[] = new Array(
    calls.length,
  );
  let next = 0;
  const started = Date.now();
  await Promise.all(
    Array.from(
      { length: Math.min(MCP_TESTING_LIMITS.concurrency, calls.length) },
      async () => {
        while (next < calls.length) {
          const index = next++;
          results[index] = await runGeneration(context, calls[index], signal);
        }
      },
    ),
  );
  let offset = 0;
  return prepared.map((test): McpTestResult => {
    if (test.kind !== 'composer') return results[offset++];
    const prompts = results.slice(
      offset,
      offset + test.prompts.length,
    ) as McpTestPromptResult[];
    offset += prompts.length;
    const segments: McpTestComposerResult['segments'] =
      test.preview.segments.map((segment) =>
        segment.kind === 'html'
          ? segment
          : {
              kind: 'prompt_output',
              promptId: segment.promptId,
              resultIndex: prompts.findIndex(
                (prompt) => prompt.metadata.id === segment.promptId,
              ),
            },
      );
    const assembled = segments
      .map((segment) =>
        segment.kind === 'html'
          ? segment.html
          : (prompts[segment.resultIndex]?.output ?? ''),
      )
      .join('');
    const output = truncateOutput(
      assembled,
      MCP_TESTING_LIMITS.assembledOutputJsonBytes,
    );
    return {
      kind: 'composer',
      metadata: test.read.metadata,
      version: test.read.version,
      dependencies: test.read.dependencies,
      diagnostics: [...test.read.diagnostics, ...test.preview.diagnostics],
      inputSource: test.source,
      status: prompts.some((prompt) => prompt.status === 'failed')
        ? 'failed'
        : 'completed',
      prompts,
      segments,
      ...output,
      outputTruncated:
        output.outputTruncated ||
        prompts.some((prompt) => prompt.outputTruncated),
      usage: sumUsage(prompts.map((prompt) => prompt.usage)),
      latencyMs: Date.now() - started,
      rendering: test.preview.rendering,
    };
  });
};
const withDeadline = async <T>(
  context: TestingContext,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException('Test deadline exceeded', 'TimeoutError'),
      ),
    MCP_TESTING_LIMITS.timeoutMs,
  );
  const signal = context.signal
    ? AbortSignal.any([context.signal, controller.signal])
    : controller.signal;
  try {
    if (signal.aborted) throw abortError(signal);
    return await run(signal);
  } finally {
    clearTimeout(timer);
  }
};
export const testPrompt = async (
  context: TestingContext,
  rawInput: unknown,
): Promise<McpTestPromptResult> =>
  withDeadline(context, async (signal) => {
    assertAuthoringJson(rawInput);
    const input = parseAuthoringValue(mcpTestPromptSchema, rawInput);
    return (
      await executePrepared(
        context,
        [await cancellable(() => preparePrompt(context, input), signal)],
        signal,
      )
    )[0] as McpTestPromptResult;
  });
export const testSnippet = async (
  context: TestingContext,
  rawInput: unknown,
): Promise<McpTestSnippetResult> =>
  withDeadline(context, async (signal) => {
    assertAuthoringJson(rawInput);
    const input = parseAuthoringValue(mcpTestSnippetSchema, rawInput);
    return (
      await executePrepared(
        context,
        [await cancellable(() => prepareSnippet(context, input), signal)],
        signal,
      )
    )[0] as McpTestSnippetResult;
  });
export const testComposer = async (
  context: TestingContext,
  rawInput: unknown,
): Promise<McpTestComposerResult> =>
  withDeadline(context, async (signal) => {
    assertAuthoringJson(rawInput);
    const input = parseAuthoringValue(mcpTestComposerSchema, rawInput);
    return (
      await executePrepared(
        context,
        [await cancellable(() => prepareComposer(context, input), signal)],
        signal,
      )
    )[0] as McpTestComposerResult;
  });
const readSample = async (
  context: TestingContext,
  kind: 'prompt' | 'composer',
  id: string,
  version: AuthoringVersionSelector,
) => {
  const read = await (kind === 'prompt' ? getPrompt : getComposer)(context.db, {
    organizationId: context.organizationId,
    id,
    version,
  });
  return {
    input: selectInput(read.definition.config, { source: 'saved_sample' }),
    versionId: read.version.id,
  };
};
export const compareTests = async (
  context: TestingContext,
  rawInput: unknown,
): Promise<McpCompareTestsResult> =>
  withDeadline(context, async (signal) => {
    const started = Date.now();
    assertAuthoringJson(rawInput);
    const input = parseAuthoringValue(mcpCompareTestsSchema, rawInput);
    const source =
      input.kind === 'snippet'
        ? input.testPhrase === undefined
          ? 'saved_sample'
          : 'supplied'
        : input.input.source;
    let commonInput: McpTestingInput = { source: 'supplied', data: {} };
    let commonPhrase: string | undefined;
    let sampleVersionId: string | null = null;
    if (input.kind === 'snippet') {
      commonPhrase = input.testPhrase;
      if (commonPhrase === undefined) {
        const sample = await cancellable(
          () =>
            getSnippet(context.db, {
              organizationId: context.organizationId,
              id: input.id,
              version: input.variants[0].version,
            }),
          signal,
        );
        commonPhrase = sample.definition.config.testUserMessage;
        sampleVersionId = sample.version.id;
      }
    } else if (input.input.source === 'saved_sample') {
      const sample = await cancellable(
        () =>
          readSample(context, input.kind, input.id, input.variants[0].version),
        signal,
      );
      commonInput = sample.input;
      sampleVersionId = sample.versionId;
    } else commonInput = input.input;
    const prepared: PreparedTest[] = [];
    for (const variant of input.variants) {
      const common = {
        id: input.id,
        version: variant.version,
        model: variant.model,
        temperature: variant.temperature,
        maxOutputTokens: input.maxOutputTokens,
      };
      const result = await cancellable(
        async () =>
          input.kind === 'snippet'
            ? await prepareSnippet(context, {
                ...common,
                testPhrase: commonPhrase,
              })
            : input.kind === 'prompt'
              ? await preparePrompt(context, { ...common, input: commonInput })
              : await prepareComposer(context, {
                  ...common,
                  input: commonInput,
                }),
        signal,
      );
      result.source = source;
      if (result.kind === 'composer')
        for (const prompt of result.prompts) prompt.source = source;
      prepared.push(result);
    }
    const results = await executePrepared(context, prepared, signal);
    return {
      kind: input.kind,
      id: input.id,
      variants: results.map((result, index) => ({
        label: input.variants[index].label,
        result,
      })),
      inputSource: source,
      sampleVersionId,
      usage: sumUsage(results.map((result) => result.usage)),
      latencyMs: Date.now() - started,
    };
  });
