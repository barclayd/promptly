import { randomBytes } from 'node:crypto';
import { type Miniflare, Response, type V4FetchHandler } from 'miniflare';
import { encryptApiKey } from '../../app/lib/encryption.server';
import {
  cleanupMcpTestRuns,
  getStoredMcpTest,
  runStoredMcpTest,
} from '../../app/lib/mcp/test-runs.server';
import { expect, test } from '../fixtures/base';
import { mcpRpc, withMcpAuthoring } from '../fixtures/mcp-authoring';

const scopes = ['mcp:read', 'mcp:write', 'mcp:publish', 'mcp:run'];
const model = 'claude-haiku-4.5';
const promptInput = {
  id: 'prompt',
  version: { kind: 'published', version: '1.0.0' },
  model,
  temperature: 0.2,
  input: { source: 'supplied', data: {} },
  maxOutputTokens: 100,
};
const call = async (
  runtime: Miniflare,
  name: string,
  args: Record<string, unknown>,
  tokenScopes = scopes,
) =>
  mcpRpc(
    runtime,
    'tools/call',
    { name, arguments: args },
    { scopes: tokenScopes },
  );

const seedKey = async (db: D1Database, encryptionKey: string) => {
  await db
    .prepare(
      "UPDATE mcp_connection SET scopes = ? WHERE id = 'connection-publish'",
    )
    .bind(JSON.stringify(scopes))
    .run();
  await db
    .prepare(`INSERT INTO llm_api_key
    (id, organization_id, name, provider, encrypted_key, key_hint, enabled_models, created_by, created_at, updated_at)
    VALUES ('test-key', 'workspace', 'Testing only', 'anthropic', ?, 'fake', ?, 'alice', 1, 1)`)
    .bind(
      await encryptApiKey('not-a-real-provider-key', encryptionKey),
      JSON.stringify([model]),
    )
    .run();
};

const providerResponse = (text: string) =>
  Response.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 5 },
  });

test('MCP testing uses workspace keys and real provider SDK requests, preserves versions and replays without another charge', async () => {
  const encryptionKey = randomBytes(32).toString('hex');
  const requests: Record<string, unknown>[] = [];
  const outboundService: V4FetchHandler = async (request) => {
    expect(new URL(request.url).host).toBe('api.anthropic.com');
    expect(request.headers.get('x-api-key')).toBe('not-a-real-provider-key');
    const body = (await request.json()) as Record<string, unknown>;
    requests.push(body);
    return providerResponse(`Output ${requests.length}`);
  };
  await withMcpAuthoring(
    async (runtime, db) => {
      await seedKey(db, encryptionKey);
      const before = await db
        .prepare(
          "SELECT config, system_message, user_message FROM prompt_version WHERE id = 'prompt-v1'",
        )
        .first();
      const first = await call(runtime, 'test_prompt', {
        ...promptInput,
        requestKey: 'prompt-test',
      });
      expect(first.body.result?.isError, JSON.stringify(first.body)).not.toBe(
        true,
      );
      expect(first.body.result?.structuredContent).toMatchObject({
        requestKey: 'prompt-test',
        status: 'completed',
        result: {
          kind: 'prompt',
          status: 'completed',
          version: { id: 'prompt-v1', version: '1.0.0' },
          config: {
            model,
            temperature: 0.2,
            maxOutputTokens: 100,
            providerModelId: 'claude-haiku-4-5-20251001',
          },
          output: 'Output 1',
          usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
        },
      });
      expect(requests[0]).toMatchObject({
        model: 'claude-haiku-4-5-20251001',
        temperature: 0.2,
        max_tokens: 100,
      });
      expect(JSON.stringify(requests[0])).toContain('First publication');
      expect(JSON.stringify(requests[0])).toContain('First user');
      const replay = await call(runtime, 'test_prompt', {
        ...promptInput,
        requestKey: 'prompt-test',
      });
      expect(replay.body.result?.structuredContent).toEqual(
        first.body.result?.structuredContent,
      );
      const recovered = await call(runtime, 'get_test_result', {
        requestKey: 'prompt-test',
      });
      expect(recovered.body.result?.structuredContent).toEqual(
        first.body.result?.structuredContent,
      );
      expect(requests).toHaveLength(1);
      const conflict = await call(runtime, 'test_prompt', {
        ...promptInput,
        temperature: 0.9,
        requestKey: 'prompt-test',
      });
      expect(conflict.body.result?.isError).toBe(true);
      expect(conflict.body.result?.structuredContent).toMatchObject({
        error: { code: 'idempotency_conflict' },
      });
      expect(
        await db
          .prepare(
            "SELECT config, system_message, user_message FROM prompt_version WHERE id = 'prompt-v1'",
          )
          .first(),
      ).toEqual(before);
      await db
        .prepare(
          "UPDATE mcp_connection SET revoked_at = 1 WHERE id = 'connection-publish'",
        )
        .run();
      expect(
        (await call(runtime, 'get_test_result', { requestKey: 'prompt-test' }))
          .response.status,
      ).toBe(401);
      expect(requests).toHaveLength(1);
    },
    true,
    true,
    { bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey }, outboundService },
  );
});

test('MCP tests snippets, composers and version comparisons through the production provider boundary', async () => {
  const encryptionKey = randomBytes(32).toString('hex');
  const requests: Record<string, unknown>[] = [];
  await withMcpAuthoring(
    async (runtime, db) => {
      await seedKey(db, encryptionKey);
      const snippet = await call(runtime, 'test_snippet', {
        id: 'snippet',
        version: { kind: 'published', version: '1.0.0' },
        model,
        temperature: 0.8,
        testPhrase: 'Try a friendly greeting',
        requestKey: 'snippet-test',
      });
      expect(
        snippet.body.result?.isError,
        JSON.stringify(snippet.body),
      ).not.toBe(true);
      expect(snippet.body.result?.structuredContent).toMatchObject({
        result: {
          kind: 'snippet',
          status: 'completed',
          config: { temperature: 0.8 },
        },
      });
      expect(JSON.stringify(requests[0])).toContain('Published snippet');
      expect(JSON.stringify(requests[0])).toContain('Try a friendly greeting');
      await db
        .prepare(
          "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
        )
        .bind(
          '<p>Before <span data-prompt-ref data-prompt-id="prompt" data-prompt-version-id="prompt-v1"></span> After <span data-prompt-ref data-prompt-id="prompt" data-prompt-version-id="prompt-v1"></span></p>',
        )
        .run();
      await db
        .prepare(
          "INSERT INTO composer_version_prompt (id, composer_version_id, prompt_id, prompt_version_id, auto_update) VALUES ('test-pin', 'composer-draft', 'prompt', 'prompt-v1', 0)",
        )
        .run();
      const composer = await call(runtime, 'test_composer', {
        id: 'composer',
        version: { kind: 'draft' },
        model,
        temperature: 0.4,
        input: { source: 'supplied', data: {} },
        requestKey: 'composer-test',
      });
      expect(
        composer.body.result?.isError,
        JSON.stringify(composer.body),
      ).not.toBe(true);
      expect(composer.body.result?.structuredContent).toMatchObject({
        result: {
          kind: 'composer',
          status: 'completed',
          prompts: [{ version: { id: 'prompt-v1' } }],
        },
      });
      expect(requests).toHaveLength(2);
      const comparison = await call(runtime, 'compare_tests', {
        kind: 'prompt',
        id: 'prompt',
        requestKey: 'compare-test',
        input: { source: 'supplied', data: {} },
        variants: [
          {
            label: 'Published',
            version: { kind: 'published', version: '1.0.0' },
            model,
            temperature: 0,
          },
          { label: 'Draft', version: { kind: 'draft' }, model, temperature: 1 },
        ],
      });
      expect(
        comparison.body.result?.isError,
        JSON.stringify(comparison.body),
      ).not.toBe(true);
      expect(comparison.body.result?.structuredContent).toMatchObject({
        result: {
          variants: [
            {
              label: 'Published',
              result: {
                version: { id: 'prompt-v1' },
                config: { temperature: 0 },
              },
            },
            {
              label: 'Draft',
              result: {
                version: { id: 'prompt-draft' },
                config: { temperature: 1 },
              },
            },
          ],
        },
      });
      expect(requests).toHaveLength(4);
    },
    true,
    true,
    {
      bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey },
      outboundService: async (request) => {
        requests.push((await request.json()) as Record<string, unknown>);
        return providerResponse(`Result ${requests.length}`);
      },
    },
  );
});

test('read and run consent executes tests on both MCP transports without granting writes', async () => {
  const encryptionKey = randomBytes(32).toString('hex');
  let calls = 0;
  await withMcpAuthoring(
    async (runtime, db) => {
      await seedKey(db, encryptionKey);
      const readRun = ['mcp:read', 'mcp:run'];
      await db
        .prepare(
          "UPDATE mcp_connection SET scopes = ? WHERE id = 'connection-read'",
        )
        .bind(JSON.stringify(readRun))
        .run();
      for (const legacy of [false, true]) {
        const options = {
          legacy,
          permission: 'read' as const,
          scopes: readRun,
        };
        const connection = await mcpRpc(
          runtime,
          'tools/call',
          { name: 'get_connection', arguments: {} },
          options,
        );
        expect(connection.body.result?.structuredContent).toMatchObject({
          scopes: readRun,
          canRunTests: true,
        });
        const tested = await mcpRpc(
          runtime,
          'tools/call',
          {
            name: 'test_prompt',
            arguments: { ...promptInput, requestKey: `read-run-${legacy}` },
          },
          options,
        );
        expect(
          tested.body.result?.isError,
          JSON.stringify(tested.body),
        ).not.toBe(true);
        expect(tested.body.result?.structuredContent).toMatchObject({
          result: { status: 'completed' },
        });
        const denied = await mcpRpc(
          runtime,
          'tools/call',
          {
            name: 'create_prompt',
            arguments: {
              definition: { name: 'Denied' },
              requestKey: `write-${legacy}`,
            },
          },
          options,
        );
        expect(denied.body.result?.structuredContent).toMatchObject({
          error: { code: 'insufficient_scope' },
        });
      }
      expect(calls).toBe(2);
    },
    true,
    true,
    {
      bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey },
      outboundService: async () => {
        calls++;
        return providerResponse('Read and run permitted');
      },
    },
  );
});

test('revocation during generation prevents returning or recovering provider output', async () => {
  const encryptionKey = randomBytes(32).toString('hex');
  let database: D1Database | undefined;
  let calls = 0;
  await withMcpAuthoring(
    async (runtime, db) => {
      database = db;
      await seedKey(db, encryptionKey);
      const result = await call(runtime, 'test_prompt', {
        ...promptInput,
        requestKey: 'revoked-in-flight',
      });
      expect(result.body.result?.isError).toBe(true);
      expect(JSON.stringify(result.body)).not.toContain(
        'Output after revocation',
      );
      expect(
        (
          await call(runtime, 'get_test_result', {
            requestKey: 'revoked-in-flight',
          })
        ).response.status,
      ).toBe(401);
      expect(calls).toBe(1);
    },
    true,
    true,
    {
      bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey },
      outboundService: async () => {
        calls++;
        await database
          ?.prepare(
            "UPDATE mcp_connection SET revoked_at = 1 WHERE id = 'connection-publish'",
          )
          .run();
        return providerResponse('Output after revocation');
      },
    },
  );
});

test('MCP testing fails closed for old grants, foreign resources, invalid variants and missing model keys before provider calls', async () => {
  let calls = 0;
  const encryptionKey = randomBytes(32).toString('hex');
  await withMcpAuthoring(
    async (runtime, db) => {
      const forbidden = await call(runtime, 'test_prompt', {
        ...promptInput,
        requestKey: 'old-grant',
      });
      expect(forbidden.body.result?.isError).toBe(true);
      expect(forbidden.body.result?.structuredContent).toMatchObject({
        error: { code: 'insufficient_scope' },
      });
      expect(
        await db.prepare('SELECT COUNT(*) AS count FROM mcp_test_run').first(),
      ).toEqual({ count: 0 });
      await seedKey(db, encryptionKey);
      for (const id of ['foreign-prompt', 'deleted-prompt', 'missing']) {
        const denied = await call(runtime, 'test_prompt', {
          ...promptInput,
          id,
          requestKey: id,
        });
        expect(denied.body.result?.isError).toBe(true);
        expect(JSON.stringify(denied.body)).not.toContain('Private foreign');
      }
      const unsupported = await call(runtime, 'test_prompt', {
        ...promptInput,
        model: 'unknown-model',
        requestKey: 'unknown-model',
      });
      expect(unsupported.body.result?.isError).toBe(true);
      const noKey = await call(runtime, 'test_prompt', {
        ...promptInput,
        model: 'gpt-5.5',
        requestKey: 'no-key',
      });
      expect(noKey.body.result?.structuredContent).toMatchObject({
        error: { code: 'key_unavailable' },
      });
      const invalidComparison = await call(runtime, 'compare_tests', {
        kind: 'prompt',
        id: 'prompt',
        requestKey: 'bad-comparison',
        input: { source: 'supplied', data: {} },
        variants: [
          { label: 'Valid', version: { kind: 'draft' }, model },
          {
            label: 'Missing',
            version: { kind: 'published', version: '99.0.0' },
            model,
          },
        ],
      });
      expect(invalidComparison.body.result?.isError).toBe(true);
      expect(calls).toBe(0);
    },
    true,
    true,
    {
      bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey },
      outboundService: async () => {
        calls++;
        return providerResponse('Should not run');
      },
    },
  );
});

test('MCP test request claims are atomic and uncertain runs never automatically execute again', async () => {
  await withMcpAuthoring(async (_runtime, db) => {
    let calls = 0;
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = () =>
      runStoredMcpTest(db, {
        connectionId: 'connection-publish',
        requestKey: 'same-key',
        operation: 'test_prompt',
        input: { model },
        toError: () => ({ code: 'provider_error', message: 'Safe error' }),
        run: async () => {
          calls++;
          await pending;
          return { output: 'Done' };
        },
      });
    const first = run();
    await expect.poll(() => calls).toBe(1);
    expect((await run()).status).toBe('running');
    release();
    const completed = await first;
    expect(await run()).toEqual(completed);
    expect(calls).toBe(1);
    await db
      .prepare(
        "UPDATE mcp_test_run SET status = 'running', result_json = NULL, created_at = 1, expires_at = 2",
      )
      .run();
    await cleanupMcpTestRuns(db);
    expect(
      (await getStoredMcpTest(db, 'connection-publish', 'same-key')).status,
    ).toBe('uncertain');
    expect((await run()).status).toBe('uncertain');
    expect(calls).toBe(1);
    await expect(
      getStoredMcpTest(db, 'connection-read', 'same-key'),
    ).rejects.toThrow('No test result');
  });
});

test('MCP provider errors are sanitized, recorded, and never automatically retried', async () => {
  const encryptionKey = randomBytes(32).toString('hex');
  let calls = 0;
  await withMcpAuthoring(
    async (runtime, db) => {
      await seedKey(db, encryptionKey);
      const args = { ...promptInput, requestKey: 'provider-failure' };
      const failed = await call(runtime, 'test_prompt', args);
      expect(failed.body.result?.isError).toBe(true);
      expect(failed.body.result?.structuredContent).toMatchObject({
        result: {
          status: 'failed',
          output: null,
          error: { code: 'provider_error' },
          usage: { inputTokens: null, outputTokens: null },
        },
      });
      expect(JSON.stringify(failed.body)).not.toContain(
        'secret-provider-detail',
      );
      expect(
        (await call(runtime, 'test_prompt', args)).body.result
          ?.structuredContent,
      ).toEqual(failed.body.result?.structuredContent);
      expect(calls).toBe(1);

      const comparisonInput = {
        kind: 'prompt',
        id: 'prompt',
        input: { source: 'supplied', data: {} },
        variants: [
          {
            label: 'Successful',
            version: { kind: 'draft' },
            model,
            temperature: 0,
          },
          {
            label: 'Failed',
            version: { kind: 'draft' },
            model,
            temperature: 0.2,
          },
        ],
        requestKey: 'partial-comparison',
      };
      const comparison = await call(runtime, 'compare_tests', comparisonInput);
      expect(comparison.body.result?.isError).toBe(true);
      expect(comparison.body.result?.structuredContent).toMatchObject({
        result: {
          variants: [
            {
              label: 'Successful',
              result: { status: 'completed', output: 'Successful variant' },
            },
            {
              label: 'Failed',
              result: { status: 'failed', error: { code: 'provider_error' } },
            },
          ],
        },
      });
      const lookup = await call(runtime, 'get_test_result', {
        requestKey: 'partial-comparison',
      });
      expect(lookup.body.result?.isError).toBe(true);
      expect(lookup.body.result?.structuredContent).toEqual(
        comparison.body.result?.structuredContent,
      );
      const replay = await call(runtime, 'compare_tests', comparisonInput);
      expect(replay.body.result?.isError).toBe(true);
      expect(replay.body.result?.structuredContent).toEqual(
        comparison.body.result?.structuredContent,
      );
      expect(calls).toBe(3);
    },
    true,
    true,
    {
      bindings: { API_KEY_ENCRYPTION_KEY: encryptionKey },
      outboundService: async (request) => {
        calls++;
        const body = (await request.json()) as { temperature?: number };
        if (body.temperature === 0)
          return providerResponse('Successful variant');
        return Response.json(
          {
            type: 'error',
            error: {
              type: 'overloaded_error',
              message: 'secret-provider-detail',
            },
          },
          { status: 529 },
        );
      },
    },
  );
});
