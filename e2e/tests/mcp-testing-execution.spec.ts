import { MockLanguageModelV4 } from 'ai/test';
import { normalizePromptDefinition } from '../../app/lib/authoring/normalize';
import { encryptApiKey } from '../../app/lib/encryption.server';
import {
  compareTests,
  type TestingContext,
  testComposer,
  testPrompt,
  testSnippet,
} from '../../app/lib/testing/execution.server';
import {
  mcpCompareTestsResultSchema,
  mcpTestComposerResultSchema,
  mcpTestPromptResultSchema,
  mcpTestSnippetResultSchema,
} from '../../app/lib/validations/mcp-testing';
import { withAuthoringDatabase } from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

const mockResult = (text = 'Generated result') => ({
  content: [{ type: 'text' as const, text }],
  finishReason: { unified: 'stop' as const, raw: undefined },
  usage: {
    inputTokens: {
      total: 12,
      noCache: 10,
      cacheRead: 2,
      cacheWrite: undefined,
    },
    outputTokens: { total: 7, text: 5, reasoning: 2 },
  },
  warnings: [],
});
const mockContext = (
  db: D1Database,
  model = new MockLanguageModelV4({
    modelId: 'mock-model',
    doGenerate: mockResult(),
  }),
) => ({
  context: {
    db,
    organizationId: 'workspace',
    resolveModel: async () => ({ ok: true as const, model }),
  } satisfies TestingContext,
  model,
});
const promptInput = {
  id: 'prompt',
  version: { kind: 'draft' },
  input: { source: 'supplied', data: {} },
} as const;
const configurePrompt = async (
  db: D1Database,
  versionId: string,
  sample = 'Saved',
) => {
  const definition = normalizePromptDefinition({
    name: 'Test',
    systemMessage: `Hello \${name}`,
    userMessage: 'Write a greeting.',
    config: {
      model: 'gpt-4o',
      temperature: 0.2,
      schema: [{ name: 'name', type: 'string' }],
      inputData: { name: sample },
    },
  }).definition;
  await db
    .prepare(
      'UPDATE prompt_version SET system_message=?, user_message=?, config=? WHERE id=?',
    )
    .bind(
      definition.systemMessage,
      definition.userMessage,
      JSON.stringify(definition.config),
      versionId,
    )
    .run();
  return definition;
};
const configureComposer = async (db: D1Database, count = 1) => {
  const ids = Array.from({ length: count }, (_, index) =>
    index ? `extra-${index}` : 'prompt',
  );
  for (const id of ids.slice(1)) {
    await db
      .prepare(
        "INSERT INTO prompt(id,name,organization_id,created_by) VALUES (?,?,'workspace','alice')",
      )
      .bind(id, id)
      .run();
    await db
      .prepare(
        "INSERT INTO prompt_version(id,prompt_id,major,minor,patch,system_message,user_message,config,created_by,published_at) VALUES (?,?,1,0,0,?,'User','{}','alice',1)",
      )
      .bind(`${id}-v1`, id, id)
      .run();
  }
  const parts = ids.map(
    (id) =>
      `<span data-prompt-ref="" data-prompt-id="${id}" data-prompt-version-id="${id === 'prompt' ? 'prompt-v1' : `${id}-v1`}"></span>`,
  );
  await db
    .prepare('UPDATE composer_version SET content=? WHERE id=?')
    .bind(`<p>Start${parts.join(' / ')}End</p>`, 'composer-draft')
    .run();
  for (const id of ids)
    await db
      .prepare(
        'INSERT INTO composer_version_prompt(id,composer_version_id,prompt_id,prompt_version_id,auto_update) VALUES (?, ?, ?, ?, 0)',
      )
      .bind(
        `ref-${id}`,
        'composer-draft',
        id,
        id === 'prompt' ? 'prompt-v1' : `${id}-v1`,
      )
      .run();
};

test('MCP prompt tests select draft or publication, interpolate inputs and snippets, and never persist overrides', async () => {
  await withAuthoringDatabase(async (db) => {
    const saved = await configurePrompt(db, 'prompt-draft');
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet(id,prompt_version_id,snippet_id,snippet_version_id,sort_order) VALUES ('ref','prompt-draft','snippet','snippet-v1',0)",
      )
      .run();
    const { context, model } = mockContext(db);
    const result = await testPrompt(context, {
      ...promptInput,
      input: { source: 'supplied', data: { name: 'Ada' } },
      model: 'claude-sonnet-4.6',
      temperature: 1.1,
      maxOutputTokens: 900,
    });
    expect(mcpTestPromptResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      status: 'completed',
      version: { id: 'prompt-draft' },
      config: {
        model: 'claude-sonnet-4.6',
        providerModelId: 'mock-model',
        temperature: 1.1,
        maxOutputTokens: 900,
      },
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
        cachedInputTokens: 2,
        reasoningTokens: 2,
      },
    });
    expect(model.doGenerateCalls[0]).toMatchObject({
      temperature: 1.1,
      maxOutputTokens: 900,
      prompt: [
        { role: 'system', content: 'Published snippet\n\nHello Ada' },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Write a greeting.' }],
        },
      ],
    });
    expect(
      await db
        .prepare("SELECT config FROM prompt_version WHERE id='prompt-draft'")
        .first('config'),
    ).toBe(JSON.stringify(saved.config));
    const published = await testPrompt(context, {
      ...promptInput,
      version: { kind: 'published', version: '1.0.0' },
    });
    expect(published.version.id).toBe('prompt-v1');
    expect(model.doGenerateCalls[1].prompt[0]).toMatchObject({
      content: 'First publication',
    });
    const latest = await testPrompt(context, {
      ...promptInput,
      version: { kind: 'latest' },
    });
    expect(latest.version.id).toBe('prompt-v2');
  });
});

test('MCP snippet tests use the selected version and explicit or saved test phrase', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare("UPDATE snippet_version SET config=? WHERE id='snippet-v1'")
      .bind(
        JSON.stringify({
          model: 'gpt-4o',
          testUserMessage: 'Saved phrase',
          temperature: 0.3,
        }),
      )
      .run();
    const { context, model } = mockContext(db);
    const saved = await testSnippet(context, {
      id: 'snippet',
      version: { kind: 'latest' },
    });
    expect(mcpTestSnippetResultSchema.safeParse(saved).success).toBe(true);
    expect(saved).toMatchObject({
      testPhraseSource: 'saved_sample',
      version: { id: 'snippet-v1' },
      config: { model: 'gpt-4o', temperature: 0.3 },
    });
    expect(model.doGenerateCalls[0].prompt).toEqual([
      { role: 'system', content: 'Published snippet' },
      { role: 'user', content: [{ type: 'text', text: 'Saved phrase' }] },
    ]);
    await testSnippet(context, {
      id: 'snippet',
      version: { kind: 'draft' },
      testPhrase: 'Override phrase',
      temperature: 0.8,
    });
    expect(model.doGenerateCalls[1]).toMatchObject({
      temperature: 0.8,
      prompt: [
        { role: 'system', content: 'Snippet draft' },
        { role: 'user', content: [{ type: 'text', text: 'Override phrase' }] },
      ],
    });
    await expect(
      testSnippet(context, { id: 'snippet', version: { kind: 'draft' } }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});

test('MCP tests reject invalid inputs, inaccessible content and wrong-parent versions before any model call', async () => {
  await withAuthoringDatabase(async (db) => {
    await configurePrompt(db, 'prompt-draft');
    const { context, model } = mockContext(db);
    for (const input of [
      { ...promptInput, id: 'foreign-prompt' },
      { ...promptInput, id: 'deleted-prompt' },
      {
        ...promptInput,
        version: { kind: 'published', versionId: 'foreign-prompt-v1' },
      },
      {
        ...promptInput,
        version: { kind: 'published', versionId: 'prompt-draft' },
      },
      { ...promptInput },
      { id: 'prompt', input: { source: 'supplied', data: {} } },
      { ...promptInput, input: { source: 'empty' } },
    ])
      await expect(testPrompt(context, input)).rejects.toBeInstanceOf(Error);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});

test('MCP model selection never silently replaces a requested model with the system model', async () => {
  await withAuthoringDatabase(async (db) => {
    const { model } = mockContext(db);
    const observed: { modelId: string; systemAnthropicKey?: string }[] = [];
    const context: TestingContext = {
      db,
      organizationId: 'workspace',
      systemAnthropicKey: 'unused-system-key',
      resolveModel: async (options) => {
        observed.push(options);
        return { ok: true, model };
      },
    };
    await testPrompt(context, { ...promptInput, model: 'gpt-4o' });
    await testPrompt(context, promptInput);
    expect(observed).toEqual([
      expect.objectContaining({
        modelId: 'gpt-4o',
        systemAnthropicKey: undefined,
      }),
      expect.objectContaining({
        modelId: 'claude-haiku-4.5',
        systemAnthropicKey: 'unused-system-key',
      }),
    ]);
    await expect(
      testPrompt(context, {
        ...promptInput,
        model: 'anthropic/claude-haiku-4.5',
      }),
    ).rejects.toMatchObject({ code: 'model_unavailable' });
    await expect(
      testPrompt(
        {
          db,
          organizationId: 'workspace',
          systemAnthropicKey: 'unused-system-key',
        },
        { ...promptInput, model: 'gpt-4o' },
      ),
    ).rejects.toMatchObject({ code: 'key_unavailable' });
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});

test('MCP resolves an encrypted workspace key and reports the actual SDK model without making network calls', async () => {
  await withAuthoringDatabase(async (db) => {
    const key = 'ab'.repeat(32);
    const encrypted = await encryptApiKey('fake-key-for-isolated-test', key);
    await db
      .prepare(
        "INSERT INTO llm_api_key(id,organization_id,name,provider,encrypted_key,key_hint,enabled_models,created_by,created_at,updated_at) VALUES ('key','workspace','Test','anthropic',?,'fake','[\"claude-haiku-4.5\"]','alice',1,1)",
      )
      .bind(encrypted)
      .run();
    let selected: string | undefined;
    const { context: mocked } = mockContext(db);
    const result = await testPrompt(
      {
        db,
        organizationId: 'workspace',
        encryptionKey: key,
        generate: async (options) => {
          selected =
            typeof options.model === 'string'
              ? options.model
              : options.model.modelId;
          expect(options.maxRetries).toBe(0);
          const mock = await mocked.resolveModel();
          const { generateText } = await import('ai');
          return generateText({ ...options, model: mock.model });
        },
      },
      promptInput,
    );
    expect(selected).toBe('claude-haiku-4-5-20251001');
    expect(result.status).toBe('completed');
  });
});

test('MCP composer runs each pinned prompt once and preserves ordered repeated segments and pinned snippets', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db);
    await db
      .prepare(
        'UPDATE composer_version SET content=\'<p>A<span data-prompt-ref="" data-prompt-id="prompt" data-prompt-version-id="prompt-v1"></span>B<span data-prompt-ref="" data-prompt-id="prompt" data-prompt-version-id="prompt-v1"></span>C</p>\' WHERE id=\'composer-draft\'',
      )
      .run();
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet(id,prompt_version_id,snippet_id,snippet_version_id,sort_order) VALUES ('ref','prompt-v1','snippet','snippet-v1',0)",
      )
      .run();
    const { context, model } = mockContext(db);
    const result = await testComposer(context, {
      id: 'composer',
      version: { kind: 'draft' },
      input: { source: 'supplied', data: {} },
    });
    expect(mcpTestComposerResultSchema.safeParse(result).success).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0].prompt[0]).toMatchObject({
      content: 'Published snippet\n\nFirst publication',
    });
    expect(result.prompts[0].version.id).toBe('prompt-v1');
    expect(result.segments).toEqual([
      { kind: 'html', html: '<p>A' },
      { kind: 'prompt_output', promptId: 'prompt', resultIndex: 0 },
      { kind: 'html', html: 'B' },
      { kind: 'prompt_output', promptId: 'prompt', resultIndex: 0 },
      { kind: 'html', html: 'C</p>' },
    ]);
    expect(result.output).toBe('<p>AGenerated resultBGenerated resultC</p>');
    await db
      .prepare("UPDATE snippet SET deleted_at=1 WHERE id='snippet'")
      .run();
    await expect(
      testComposer(context, {
        id: 'composer',
        version: { kind: 'draft' },
        input: { source: 'supplied', data: {} },
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

test('MCP comparisons share the first selected saved sample and preflight every variant before paid work', async () => {
  await withAuthoringDatabase(async (db) => {
    await configurePrompt(db, 'prompt-draft', 'Same input');
    await configurePrompt(db, 'prompt-v1', 'Other input');
    const { context, model } = mockContext(db);
    const input = {
      kind: 'prompt',
      id: 'prompt',
      input: { source: 'saved_sample' },
      variants: [
        { label: 'Draft', version: { kind: 'draft' }, temperature: 0 },
        {
          label: 'Published',
          version: { kind: 'published', version: '1.0.0' },
          temperature: 1,
        },
      ],
    };
    const result = await compareTests(context, input);
    expect(mcpCompareTestsResultSchema.safeParse(result).success).toBe(true);
    expect(result.sampleVersionId).toBe('prompt-draft');
    expect(result.variants.map((variant) => variant.label)).toEqual([
      'Draft',
      'Published',
    ]);
    expect(result.usage).toMatchObject({
      inputTokens: 24,
      outputTokens: 14,
      totalTokens: 38,
    });
    expect(model.doGenerateCalls.map((call) => call.prompt[0])).toEqual([
      { role: 'system', content: 'Hello Same input' },
      { role: 'system', content: 'Hello Same input' },
    ]);
    await expect(
      compareTests(context, {
        ...input,
        variants: [
          input.variants[0],
          { ...input.variants[1], model: 'not-a-model' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'model_unavailable' });
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});

test('MCP execution bounds parallelism, returns stable order and isolates sanitized provider failures', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db, 6);
    let active = 0;
    let maximum = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        if (
          options.prompt[0].role === 'system' &&
          options.prompt[0].content === 'extra-2'
        )
          throw new Error('SECRET provider key and customer data');
        return mockResult();
      },
    });
    const { context } = mockContext(db, model);
    const result = await testComposer(context, {
      id: 'composer',
      version: { kind: 'draft' },
      input: { source: 'supplied', data: {} },
    });
    expect(maximum).toBe(4);
    expect(model.doGenerateCalls).toHaveLength(6);
    expect(result.status).toBe('failed');
    expect(result.prompts.map((prompt) => prompt.metadata.id)).toEqual([
      'prompt',
      'extra-1',
      'extra-2',
      'extra-3',
      'extra-4',
      'extra-5',
    ]);
    expect(result.prompts[2].error).toMatchObject({ code: 'provider_error' });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.usage.inputTokens).toBeNull();
  });
});

test('MCP cancellation and revoked permissions prevent queued calls and do not expose provider secrets', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db, 6);
    const controller = new AbortController();
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        controller.abort();
        return mockResult();
      },
    });
    const { context } = mockContext(db, model);
    const result = await testComposer(
      { ...context, signal: controller.signal },
      {
        id: 'composer',
        version: { kind: 'draft' },
        input: { source: 'supplied', data: {} },
      },
    );
    expect(model.doGenerateCalls.length).toBeLessThanOrEqual(4);
    expect(result.status).toBe('failed');
    expect(
      result.prompts
        .slice(4)
        .every(
          (prompt) => !prompt.executed && prompt.error?.code === 'cancelled',
        ),
    ).toBe(true);
    const denied = await testPrompt(
      {
        ...context,
        beforeGenerate: async () => {
          throw new Error('SECRET membership lookup');
        },
      },
      promptInput,
    );
    expect(denied).toMatchObject({
      executed: false,
      status: 'failed',
      error: { code: 'access_denied' },
    });
    expect(JSON.stringify(denied)).not.toContain('SECRET');
  });
});

test('MCP tests enforce composer and comparison call limits and bound generated output', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db, 9);
    const { context, model } = mockContext(
      db,
      new MockLanguageModelV4({ doGenerate: mockResult('🙂'.repeat(20_000)) }),
    );
    await expect(
      testComposer(context, {
        id: 'composer',
        version: { kind: 'draft' },
        input: { source: 'supplied', data: {} },
      }),
    ).rejects.toMatchObject({ code: 'call_limit' });
    expect(model.doGenerateCalls).toHaveLength(0);
    const result = await testPrompt(context, promptInput);
    expect(result.outputTruncated).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(result.output)).length,
    ).toBeLessThanOrEqual(32_768);
    expect(result.output).not.toContain('�');
    expect(result.usage.outputTokens).toBe(7);
    await db
      .prepare("DELETE FROM composer_version_prompt WHERE prompt_id='extra-8'")
      .run();
    await db
      .prepare(
        'UPDATE composer_version SET content=replace(content, \'<span data-prompt-ref="" data-prompt-id="extra-8" data-prompt-version-id="extra-8-v1"></span>\', \'\') WHERE id=\'composer-draft\'',
      )
      .run();
    await expect(
      compareTests(context, {
        kind: 'composer',
        id: 'composer',
        input: { source: 'supplied', data: {} },
        variants: [1, 2, 3].map((n) => ({
          label: String(n),
          version: { kind: 'draft' },
        })),
      }),
    ).rejects.toMatchObject({ code: 'call_limit' });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

test('MCP draft composers can test unpublished unpinned prompts while exact pins never fall back', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "INSERT INTO prompt_version(id,prompt_id,system_message,user_message,config,created_by) VALUES ('new-draft','empty-prompt','Unpublished system','Unpublished user','{}','alice')",
      )
      .run();
    await db
      .prepare('UPDATE composer_version SET content=? WHERE id=?')
      .bind(
        '<p><span data-prompt-ref="" data-prompt-id="empty-prompt"></span></p>',
        'composer-draft',
      )
      .run();
    await db
      .prepare(
        "INSERT INTO composer_version_prompt(id,composer_version_id,prompt_id,auto_update) VALUES ('new-ref','composer-draft','empty-prompt',1)",
      )
      .run();
    const { context, model } = mockContext(db);
    const input = {
      id: 'composer',
      version: { kind: 'draft' },
      input: { source: 'supplied', data: {} },
    };
    const result = await testComposer(context, input);
    expect(result.status).toBe('completed');
    expect(result.prompts[0].version).toMatchObject({
      id: 'new-draft',
      status: 'draft',
    });
    expect(result.dependencies[0]).toMatchObject({
      pinnedVersionId: null,
      resolvedVersionId: 'new-draft',
      resolvedVersion: null,
    });
    expect(model.doGenerateCalls[0].prompt[0]).toMatchObject({
      content: 'Unpublished system',
    });
    await db
      .prepare('UPDATE composer_version SET content=? WHERE id=?')
      .bind(
        '<p><span data-prompt-ref="" data-prompt-id="empty-prompt" data-prompt-version-id="new-draft"></span></p>',
        'composer-draft',
      )
      .run();
    await db
      .prepare(
        "UPDATE composer_version_prompt SET prompt_version_id='new-draft',auto_update=0 WHERE id='new-ref'",
      )
      .run();
    await expect(testComposer(context, input)).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

test('MCP snippet comparison uses one common phrase across saved configurations', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare("UPDATE snippet_version SET config=? WHERE id='snippet-draft'")
      .bind(JSON.stringify({ testUserMessage: 'Common phrase' }))
      .run();
    await db
      .prepare("UPDATE snippet_version SET config=? WHERE id='snippet-v1'")
      .bind(JSON.stringify({ testUserMessage: 'Different saved phrase' }))
      .run();
    const { context, model } = mockContext(db);
    const result = await compareTests(context, {
      kind: 'snippet',
      id: 'snippet',
      variants: [
        { label: 'Draft', version: { kind: 'draft' } },
        { label: 'Published', version: { kind: 'latest' } },
      ],
    });
    expect(result.sampleVersionId).toBe('snippet-draft');
    expect(model.doGenerateCalls.map((call) => call.prompt[1])).toEqual(
      [1, 2].map(() => ({
        role: 'user',
        content: [{ type: 'text', text: 'Common phrase' }],
      })),
    );
    expect(result.variants.map((variant) => variant.result.version.id)).toEqual(
      ['snippet-draft', 'snippet-v1'],
    );
  });
});

test('MCP deadline covers preflight model resolution before any provider call', async () => {
  await withAuthoringDatabase(async (db) => {
    const controller = new AbortController();
    const { context, model } = mockContext(db);
    await expect(
      testPrompt(
        {
          ...context,
          signal: controller.signal,
          resolveModel: async () => {
            controller.abort(new DOMException('Timed out', 'TimeoutError'));
            return { ok: true, model };
          },
        },
        promptInput,
      ),
    ).rejects.toMatchObject({ code: 'timeout' });
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});

test('MCP comparison output stays below one MiB even with repeated JSON-escaped provider text', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db, 4);
    const { context } = mockContext(
      db,
      new MockLanguageModelV4({
        doGenerate: mockResult('\u0000🙂"\\'.repeat(10_000)),
      }),
    );
    const input = {
      kind: 'composer',
      id: 'composer',
      input: { source: 'supplied', data: {} },
      variants: [1, 2, 3, 4].map((n) => ({
        label: String(n),
        version: { kind: 'draft' },
      })),
    };
    const result = await compareTests(context, input);
    expect(mcpCompareTestsResultSchema.safeParse(result).success).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(result)).length,
    ).toBeLessThan(1024 * 1024);
    for (const variant of result.variants) {
      expect(variant.result.outputTruncated).toBe(true);
      expect(variant.result.output).not.toContain('�');
      expect(
        new TextEncoder().encode(JSON.stringify(variant.result.output)).length,
      ).toBeLessThanOrEqual(65_536);
    }
  });
});

test('MCP rejects oversized static composer results before making a paid provider request', async () => {
  await withAuthoringDatabase(async (db) => {
    await configureComposer(db);
    const prefix = `<p>${'x'.repeat(140_000)}</p>`;
    await db
      .prepare(
        "UPDATE composer_version SET content=? || content WHERE id='composer-draft'",
      )
      .bind(prefix)
      .run();
    const { context, model } = mockContext(db);
    await expect(
      testComposer(context, {
        id: 'composer',
        version: { kind: 'draft' },
        input: { source: 'supplied', data: {} },
      }),
    ).rejects.toMatchObject({ code: 'call_limit' });
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});

test('MCP reports ignored model settings without exposing raw provider warning details', async () => {
  await withAuthoringDatabase(async (db) => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        ...mockResult(),
        warnings: [
          {
            type: 'unsupported',
            feature: 'temperature',
            details: 'Provider-specific detail',
          },
        ],
      },
    });
    const { context } = mockContext(db, model);
    const result = await testPrompt(context, {
      ...promptInput,
      temperature: 1,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported_model_setting',
        severity: 'warning',
        path: ['config', 'temperature'],
      }),
    );
    expect(JSON.stringify(result)).not.toContain('Provider-specific detail');
  });
});
