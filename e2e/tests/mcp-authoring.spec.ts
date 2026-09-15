import type { Miniflare } from 'miniflare';
import { z } from 'zod';
import {
  mcpAuthoringChangeOutputSchema,
  mcpAuthoringChangesOutputSchema,
  mcpAuthoringErrorSchema,
  mcpAuthoringModelsOutputSchema,
  mcpAuthoringMutationOutputSchema,
  mcpAuthoringValidationOutputSchema,
  mcpAuthoringVersionsOutputSchema,
  mcpComposerMarkupOutputSchema,
  mcpComposerPreviewOutputSchema,
  mcpComposerReadOutputSchema,
  mcpPromptPreviewOutputSchema,
  mcpPromptReadOutputSchema,
  mcpSnippetReadOutputSchema,
} from '../../app/lib/validations/mcp-authoring';
import { expect, test } from '../fixtures/base';
import { mcpRpc, withMcpAuthoring } from '../fixtures/mcp-authoring';

const call = async <Output>(
  runtime: Miniflare,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<Output>,
  options?: Parameters<typeof mcpRpc>[3],
) => {
  const { body, response } = await mcpRpc(
    runtime,
    'tools/call',
    { name, arguments: args },
    options,
  );
  expect(response.status).toBe(200);
  expect(body.error).toBeUndefined();
  expect(body.result?.isError, JSON.stringify(body)).not.toBe(true);
  const content = z
    .array(z.object({ type: z.literal('text'), text: z.string() }))
    .parse(body.result?.content);
  expect(JSON.parse(content[0]?.text ?? 'null')).toEqual(
    body.result?.structuredContent,
  );
  return schema.parse(body.result?.structuredContent);
};

const failedCall = async (
  runtime: Miniflare,
  name: string,
  args: Record<string, unknown>,
  options?: Parameters<typeof mcpRpc>[3],
) => {
  const { body } = await mcpRpc(
    runtime,
    'tools/call',
    { name, arguments: args },
    options,
  );
  expect(body.error).toBeUndefined();
  expect(body.result?.isError, JSON.stringify(body)).toBe(true);
  return mcpAuthoringErrorSchema.parse(body.result?.structuredContent).error;
};

const toolsSchema = z.array(
  z.object({
    name: z.string(),
    inputSchema: z.record(z.string(), z.unknown()),
    outputSchema: z.record(z.string(), z.unknown()),
    annotations: z.object({ readOnlyHint: z.boolean() }),
  }),
);

test('OAuth resource discovery advertises authoring scopes only when authoring is enabled', async () => {
  for (const enabled of [false, true]) {
    await withMcpAuthoring(async (runtime) => {
      for (const path of [
        '/.well-known/oauth-protected-resource/mcp',
        '/.well-known/oauth-protected-resource',
      ]) {
        const response = await runtime.dispatchFetch(
          `https://mcp.test${path}`,
          { headers: { 'X-Test-OAuth': 'true' } },
        );
        expect(response.status).toBe(200);
        const metadata = z
          .object({
            resource: z.string(),
            scopes_supported: z.array(z.string()),
          })
          .parse(await response.json());
        expect(metadata.resource).toBe('https://mcp.test/mcp');
        expect(metadata.scopes_supported).toEqual(
          enabled ? ['mcp:read', 'mcp:write', 'mcp:publish'] : ['mcp:read'],
        );
      }
    }, enabled);
  }
});

test('MCP authoring remains absent until the rollout flag is enabled', async () => {
  await withMcpAuthoring(async (runtime) => {
    const listing = await mcpRpc(runtime, 'tools/list');
    expect(
      toolsSchema.parse(listing.body.result?.tools).map((tool) => tool.name),
    ).toEqual(['get_connection', 'search_content']);
    const connection = await mcpRpc(runtime, 'tools/call', {
      name: 'get_connection',
      arguments: {},
    });
    expect(connection.body.result?.structuredContent).toMatchObject({
      authoringAvailable: false,
    });
    const absent = await mcpRpc(runtime, 'tools/call', {
      name: 'create_prompt',
      arguments: { requestKey: 'disabled', definition: { name: 'Disabled' } },
    });
    expect(JSON.stringify(absent.body)).toContain('not found');
    const menu = await mcpRpc(runtime, 'prompts/list');
    expect(menu.body.error).toBeDefined();
  }, false);
});

test('modern and legacy MCP discover the same explicit authoring contracts', async () => {
  await withMcpAuthoring(async (runtime) => {
    const modern = await mcpRpc(runtime, 'tools/list');
    const tools = toolsSchema.parse(modern.body.result?.tools);
    expect(tools).toHaveLength(21);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_prompt',
        'get_composer',
        'get_snippet',
        'create_prompt',
        'create_composer',
        'update_prompt',
        'update_composer',
        'publish_prompt',
        'publish_composer',
        'restore_change',
      ]),
    );
    expect(
      tools.some((tool) =>
        /delete|create_snippet|update_snippet/.test(tool.name),
      ),
    ).toBe(false);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
      expect(tool.annotations.readOnlyHint).toBe(
        !/^(create|update|publish|restore)_/.test(tool.name),
      );
    }
    const initialized = await mcpRpc(
      runtime,
      'initialize',
      {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'Legacy regression', version: '1.0.0' },
      },
      { legacy: true },
    );
    expect(initialized.body.result?.capabilities).toMatchObject({
      prompts: { listChanged: false },
    });
    const legacy = await mcpRpc(runtime, 'tools/list', {}, { legacy: true });
    expect(toolsSchema.parse(legacy.body.result?.tools)).toEqual(tools);
    for (const permission of ['read', 'edit', 'publish'] as const) {
      for (const legacy of [true, false]) {
        const connection = await mcpRpc(
          runtime,
          'tools/call',
          { name: 'get_connection', arguments: {} },
          { permission, legacy },
        );
        expect(connection.body.result?.structuredContent).toEqual({
          workspaceId: 'workspace',
          scopes:
            permission === 'read'
              ? ['mcp:read']
              : permission === 'edit'
                ? ['mcp:read', 'mcp:write']
                : ['mcp:read', 'mcp:write', 'mcp:publish'],
          authoringAvailable: true,
        });
      }
    }
    const warmed = await mcpRpc(runtime, 'tools/list');
    expect(toolsSchema.parse(warmed.body.result?.tools)).toEqual(tools);
    const prompt = await call(
      runtime,
      'get_prompt',
      { id: 'prompt', version: { kind: 'latest' } },
      mcpPromptReadOutputSchema,
      { legacy: true },
    );
    expect(prompt.version.version).toBe('2.0.0');
  });
});

test('MCP builds, previews, publishes, revises and restores related prompts and a composer', async () => {
  await withMcpAuthoring(async (runtime, db) => {
    const created = await call(
      runtime,
      'create_prompt',
      {
        requestKey: 'create-pilot-prompt',
        definition: {
          name: 'Pilot prompt',
          systemMessage: `Help \${customer}`,
          userMessage: 'Write a brief.',
          config: {
            schema: [{ name: 'customer', type: 'string' }],
            inputData: { customer: 'Saved sample' },
          },
          snippets: [
            { snippetId: 'snippet', snippetVersionId: null, sortOrder: 0 },
          ],
        },
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(created).toMatchObject({
      status: 'draft',
      version: null,
      url: `https://mcp.test/prompts/${created.id}`,
    });
    expect(created.assignedIds).toHaveLength(1);
    const draft = await call(
      runtime,
      'get_prompt',
      { id: created.id, version: { kind: 'draft' } },
      mcpPromptReadOutputSchema,
    );
    expect(draft.definition.config.schema[0]?.id).toBe(
      created.assignedIds[0]?.id,
    );
    expect(draft.metadata.revision).toBe(created.revision);
    const ready = await call(
      runtime,
      'validate_prompt',
      { id: created.id, version: { kind: 'draft' } },
      mcpAuthoringValidationOutputSchema,
    );
    expect(ready.valid).toBe(true);
    const preview = await call(
      runtime,
      'preview_prompt',
      {
        id: created.id,
        version: { kind: 'draft' },
        input: { source: 'supplied', data: { customer: 'Acme' } },
      },
      mcpPromptPreviewOutputSchema,
    );
    expect(preview).toMatchObject({
      valid: true,
      executed: false,
      userMessage: 'Write a brief.',
    });
    expect(preview.systemMessage).toContain('Help Acme');
    expect(preview.systemMessage).toContain('Published snippet');
    const published = await call(
      runtime,
      'publish_prompt',
      {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'publish-pilot',
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(published.version).toBe('1.0.0');

    const markup = await call(
      runtime,
      'generate_composer_markup',
      {
        parts: [
          { kind: 'raw_html', html: '<h1>Brief</h1>' },
          { kind: 'prompt', promptId: created.id },
        ],
      },
      mcpComposerMarkupOutputSchema,
    );
    const composer = await call(
      runtime,
      'create_composer',
      {
        requestKey: 'create-pilot-composer',
        definition: {
          name: 'Pilot composer',
          content: markup.html,
          config: { schema: [{ name: 'customer', type: 'string' }] },
        },
      },
      mcpAuthoringMutationOutputSchema,
    );
    const composerReady = await call(
      runtime,
      'validate_composer',
      { id: composer.id, version: { kind: 'draft' } },
      mcpAuthoringValidationOutputSchema,
    );
    expect(composerReady.valid, JSON.stringify(composerReady.diagnostics)).toBe(
      true,
    );
    const composerPreview = await call(
      runtime,
      'preview_composer',
      {
        id: composer.id,
        version: { kind: 'draft' },
        input: { source: 'supplied', data: { customer: 'Acme' } },
      },
      mcpComposerPreviewOutputSchema,
    );
    expect(composerPreview.executed).toBe(false);
    expect(composerPreview.segments).toContainEqual(
      expect.objectContaining({
        kind: 'prompt_placeholder',
        promptId: created.id,
      }),
    );
    const publishedComposer = await call(
      runtime,
      'publish_composer',
      {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'publish-composer',
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(publishedComposer.version).toBe('1.0.0');
    const composerRead = await call(
      runtime,
      'get_composer',
      { id: composer.id, version: { kind: 'latest' } },
      mcpComposerReadOutputSchema,
    );
    expect(composerRead.dependencies[0]?.resolvedVersionId).toBe(
      published.versionId,
    );
    const composerRevised = await call(
      runtime,
      'update_composer',
      {
        id: composer.id,
        expectedRevision: publishedComposer.revision,
        requestKey: 'revise-composer',
        edit: {
          mode: 'patch',
          replacements: [
            {
              field: 'content',
              oldText: 'Brief',
              newText: 'Updated brief',
            },
          ],
        },
      },
      mcpAuthoringMutationOutputSchema,
      { legacy: true },
    );
    expect(composerRevised.status).toBe('draft');
    const composerAfter = await call(
      runtime,
      'get_composer',
      { id: composer.id, version: { kind: 'draft' } },
      mcpComposerReadOutputSchema,
    );
    expect(composerAfter.definition.content).toContain('Updated brief');

    const revisionInput = {
      id: created.id,
      expectedRevision: published.revision,
      requestKey: 'revise-pilot',
      edit: {
        mode: 'patch',
        replacements: [
          { field: 'userMessage', oldText: 'brief', newText: 'detailed brief' },
        ],
      },
    };
    const revised = await call(
      runtime,
      'update_prompt',
      revisionInput,
      mcpAuthoringMutationOutputSchema,
    );
    expect(revised.status).toBe('draft');
    const conflict = await failedCall(runtime, 'update_prompt', {
      ...revisionInput,
      requestKey: 'stale-revision',
    });
    expect(conflict).toMatchObject({
      code: 'stale_revision',
      details: { currentRevision: revised.revision },
    });
    const restored = await call(
      runtime,
      'restore_change',
      {
        id: created.id,
        kind: 'prompt',
        expectedRevision: revised.revision,
        requestKey: 'restore-pilot',
        changeId: revised.changeId,
        phase: 'before',
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(restored.status).toBe('draft');
    const replay = await call(
      runtime,
      'update_prompt',
      revisionInput,
      mcpAuthoringMutationOutputSchema,
    );
    expect(replay).toEqual(revised);
    const saved = await call(
      runtime,
      'get_prompt',
      { id: created.id, version: { kind: 'working' } },
      mcpPromptReadOutputSchema,
    );
    expect(saved.definition.userMessage).toBe('Write a brief.');
    const change = await call(
      runtime,
      'get_change',
      { changeId: revised.changeId },
      mcpAuthoringChangeOutputSchema,
    );
    expect(change.after).toMatchObject({
      kind: 'prompt',
      definition: { userMessage: 'Write a detailed brief.' },
    });
    const changes = await call(
      runtime,
      'list_changes',
      { kind: 'prompt', id: created.id },
      mcpAuthoringChangesOutputSchema,
    );
    expect(changes.items.map((item) => item.id)).toContain(restored.changeId);
    const versions = await call(
      runtime,
      'list_versions',
      { kind: 'prompt', id: created.id },
      mcpAuthoringVersionsOutputSchema,
    );
    expect(
      versions.items.filter((item) => item.status === 'published'),
    ).toHaveLength(1);
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS count FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL',
        )
        .bind(created.id)
        .first<number>('count'),
    ).toBe(1);
  });
});

test('MCP enforces live scope, workspace, revision and argument boundaries with safe structured errors', async () => {
  await withMcpAuthoring(async (runtime, db) => {
    expect(
      (
        await failedCall(
          runtime,
          'create_prompt',
          { requestKey: 'no-write', definition: { name: 'Denied' } },
          { permission: 'read' },
        )
      ).code,
    ).toBe('insufficient_scope');
    const current = await call(
      runtime,
      'get_prompt',
      { id: 'prompt', version: { kind: 'draft' } },
      mcpPromptReadOutputSchema,
      { permission: 'read' },
    );
    expect(
      (
        await failedCall(
          runtime,
          'publish_prompt',
          {
            id: 'prompt',
            expectedRevision: current.metadata.revision,
            requestKey: 'no-publish',
          },
          { permission: 'edit' },
        )
      ).code,
    ).toBe('insufficient_scope');
    expect(
      (
        await failedCall(runtime, 'get_prompt', {
          id: 'foreign-prompt',
          version: { kind: 'latest' },
        })
      ).code,
    ).toBe('content_not_found');
    expect(
      (
        await failedCall(runtime, 'get_prompt', {
          id: 'prompt',
          version: { kind: 'published', version: '9.0.0' },
        })
      ).code,
    ).toBe('version_not_found');
    expect(
      (
        await failedCall(runtime, 'update_prompt', {
          id: 'prompt',
          requestKey: 'missing-revision',
          edit: { mode: 'patch', changes: { name: 'Invalid' } },
        })
      ).code,
    ).toBe('invalid_input');
    const snippet = await call(
      runtime,
      'get_snippet',
      { id: 'snippet', version: { kind: 'draft' } },
      mcpSnippetReadOutputSchema,
      { permission: 'read' },
    );
    expect(snippet.definition.content).toBe('Snippet draft');
    const models = await call(
      runtime,
      'list_available_models',
      {},
      mcpAuthoringModelsOutputSchema,
    );
    expect(models.items).toEqual([]);
    expect(JSON.stringify(current)).not.toContain('987654');
    for (const scopes of [null, [], ['mcp:bogus']]) {
      const denied = await mcpRpc(runtime, 'tools/list', {}, { scopes });
      expect(denied.response.status).toBe(401);
    }
    await db
      .prepare(
        "UPDATE mcp_connection SET revoked_at = 1 WHERE id = 'connection-publish'",
      )
      .run();
    const revoked = await mcpRpc(runtime, 'tools/call', {
      name: 'get_prompt',
      arguments: { id: 'prompt', version: { kind: 'draft' } },
    });
    expect(revoked.response.status).toBe(401);
    await db.prepare("DELETE FROM member WHERE id = 'member'").run();
    const removed = await mcpRpc(
      runtime,
      'tools/list',
      {},
      { permission: 'read' },
    );
    expect(removed.response.status).toBe(403);
  });
});

test('native MCP prompt menus paginate only published workspace content and require supplied valid inputs', async () => {
  await withMcpAuthoring(async (runtime, db) => {
    const created = await call(
      runtime,
      'create_prompt',
      {
        requestKey: 'native-prompt',
        definition: {
          name: 'Native prompt',
          systemMessage: `Hello \${customer}`,
          userMessage: 'Answer me',
          config: { schema: [{ name: 'customer', type: 'string' }] },
        },
      },
      mcpAuthoringMutationOutputSchema,
    );
    const initial = await mcpRpc(runtime, 'prompts/list');
    expect(initial.body.result?.prompts).toEqual([
      expect.objectContaining({ name: 'prompt' }),
    ]);
    await db
      .prepare(
        "UPDATE prompt SET name = ?, description = ? WHERE id = 'prompt'",
      )
      .bind('n'.repeat(201), 'd'.repeat(4001))
      .run();
    const bounded = await mcpRpc(runtime, 'prompts/list');
    expect(bounded.body.result?.prompts).toEqual([
      expect.objectContaining({
        title: 'n'.repeat(200),
        description: 'd'.repeat(4000),
      }),
    ]);
    const published = await call(
      runtime,
      'publish_prompt',
      {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'native-publish',
      },
      mcpAuthoringMutationOutputSchema,
    );
    for (const args of [
      {},
      { input: 'not-json' },
      { input: '{}' },
      { input: '{"customer":"Acme"}', version: '99.0.0' },
    ]) {
      const invalid = await mcpRpc(runtime, 'prompts/get', {
        name: created.id,
        arguments: args,
      });
      expect(invalid.body.error).toBeDefined();
    }
    for (const legacy of [false, true]) {
      const prepared = await mcpRpc(
        runtime,
        'prompts/get',
        {
          name: created.id,
          arguments: {
            input: '{"customer":"Acme"}',
            versionId: published.versionId,
          },
        },
        { legacy },
      );
      expect(prepared.body.error).toBeUndefined();
      expect(prepared.body.result?.messages).toEqual([
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Prepared system instructions:\nHello Acme\n\nPrepared user message:\nAnswer me',
          },
        },
      ]);
      expect(prepared.body.result?.description).toContain(
        'not applied to the host',
      );
    }
    const foreign = await mcpRpc(runtime, 'prompts/get', {
      name: 'foreign-prompt',
      arguments: { input: '{}' },
    });
    expect(foreign.body.error).toBeDefined();
    await db.batch(
      Array.from({ length: 51 }, (_, index) => {
        const id = `native-page-${String(index).padStart(2, '0')}`;
        return [
          db
            .prepare(
              "INSERT INTO prompt (id, name, organization_id, created_by) VALUES (?, ?, 'workspace', 'alice')",
            )
            .bind(id, id),
          db
            .prepare(
              "INSERT INTO prompt_version (id, prompt_id, major, minor, patch, system_message, user_message, config, created_by, published_at) VALUES (?, ?, 1, 0, 0, '', '', '{}', 'alice', 1)",
            )
            .bind(`${id}-version`, id),
        ];
      }).flat(),
    );
    const pageSchema = z.object({
      prompts: z.array(
        z.object({
          name: z.string(),
          arguments: z.array(
            z.object({ name: z.string(), required: z.boolean() }),
          ),
        }),
      ),
      nextCursor: z.string().optional(),
    });
    const first = pageSchema.parse(
      (await mcpRpc(runtime, 'prompts/list')).body.result,
    );
    expect(first.prompts).toHaveLength(50);
    expect(first.nextCursor).toBeDefined();
    expect(first.prompts[0]?.arguments).toContainEqual({
      name: 'input',
      required: true,
    });
    const second = pageSchema.parse(
      (await mcpRpc(runtime, 'prompts/list', { cursor: first.nextCursor })).body
        .result,
    );
    expect(second.prompts).toHaveLength(3);
    expect(second.nextCursor).toBeUndefined();
    expect(
      new Set(
        [...first.prompts, ...second.prompts].map((prompt) => prompt.name),
      ).size,
    ).toBe(53);
    for (const cursor of [
      'bad cursor',
      btoa(JSON.stringify({ workspaceId: 'foreign', after: 'x' })),
    ]) {
      expect(
        (await mcpRpc(runtime, 'prompts/list', { cursor })).body.error,
      ).toBeDefined();
    }
  });
});

test('MCP exposes owned broken definitions for repair without resolving inaccessible metadata or publishing them', async () => {
  await withMcpAuthoring(async (runtime, db) => {
    const created = await call(
      runtime,
      'create_prompt',
      {
        requestKey: 'repair-create',
        definition: {
          name: 'Repairable',
          systemMessage: 'Own content',
          snippets: [
            {
              snippetId: 'snippet',
              snippetVersionId: 'snippet-v1',
              sortOrder: 0,
            },
          ],
        },
      },
      mcpAuthoringMutationOutputSchema,
    );
    const published = await call(
      runtime,
      'publish_prompt',
      {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'repair-publish',
      },
      mcpAuthoringMutationOutputSchema,
    );
    await db
      .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
      .run();
    const broken = await call(
      runtime,
      'get_prompt',
      { id: created.id, version: { kind: 'latest' } },
      mcpPromptReadOutputSchema,
    );
    expect(broken.definition.systemMessage).toBe('Own content');
    expect(broken.definition.snippets[0]?.snippetId).toBe('snippet');
    expect(broken.dependencies).toEqual([]);
    expect(broken.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reference_unavailable' }),
    );
    const validation = await call(
      runtime,
      'validate_prompt',
      { id: created.id, version: { kind: 'latest' } },
      mcpAuthoringValidationOutputSchema,
    );
    expect(validation.valid).toBe(false);
    expect(
      (
        await mcpRpc(runtime, 'prompts/get', {
          name: created.id,
          arguments: { input: '{}' },
        })
      ).body.error,
    ).toBeDefined();
    expect(
      (
        await failedCall(runtime, 'update_prompt', {
          id: created.id,
          expectedRevision: published.revision,
          requestKey: 'retain-broken',
          edit: { mode: 'patch', changes: { name: 'Still broken' } },
        })
      ).code,
    ).toBe('reference_unavailable');
    const repaired = await call(
      runtime,
      'update_prompt',
      {
        id: created.id,
        expectedRevision: published.revision,
        requestKey: 'repair-remove',
        edit: { mode: 'patch', changes: { snippets: [] } },
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(repaired.status).toBe('draft');

    const foreignContent =
      '<p>Owned draft</p><span data-prompt-ref="" data-prompt-id="foreign-prompt"></span>';
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind(foreignContent)
      .run();
    const composer = await call(
      runtime,
      'get_composer',
      { id: 'composer', version: { kind: 'draft' } },
      mcpComposerReadOutputSchema,
    );
    expect(composer.definition.content).toBe(foreignContent);
    expect(composer.dependencies).toEqual([]);
    expect(JSON.stringify(composer)).not.toContain('Private foreign');
    const invalid = await call(
      runtime,
      'validate_composer',
      { id: 'composer', version: { kind: 'draft' } },
      mcpAuthoringValidationOutputSchema,
    );
    expect(invalid.valid).toBe(false);
    expect(
      (
        await failedCall(runtime, 'publish_composer', {
          id: 'composer',
          expectedRevision: composer.metadata.revision,
          requestKey: 'foreign-publish',
        })
      ).code,
    ).toBe('reference_unavailable');
    const composerRepair = await call(
      runtime,
      'update_composer',
      {
        id: 'composer',
        expectedRevision: composer.metadata.revision,
        requestKey: 'remove-foreign',
        edit: { mode: 'patch', changes: { content: '<p>Repaired</p>' } },
      },
      mcpAuthoringMutationOutputSchema,
    );
    expect(composerRepair.status).toBe('draft');
  });
});

test('authoring transport accepts complete large definitions while keeping bounded MCP and OAuth bodies', async () => {
  await withMcpAuthoring(async (runtime) => {
    const content = 'Long prompt text. '.repeat(9000);
    const created = await call(
      runtime,
      'create_prompt',
      {
        requestKey: 'large-prompt',
        definition: { name: 'Large prompt', systemMessage: content },
      },
      mcpAuthoringMutationOutputSchema,
    );
    const read = await call(
      runtime,
      'get_prompt',
      { id: created.id, version: { kind: 'draft' } },
      mcpPromptReadOutputSchema,
    );
    expect(read.definition.systemMessage).toBe(content);
    const under = await mcpRpc(
      runtime,
      'tools/call',
      {
        name: 'create_prompt',
        arguments: {
          requestKey: 'large-unauth',
          definition: { name: 'Large', systemMessage: content },
        },
      },
      { oauth: true },
    );
    expect(under.response.status).toBe(401);
    const over = await mcpRpc(
      runtime,
      'tools/call',
      {
        name: 'create_prompt',
        arguments: {
          requestKey: 'too-large',
          definition: { name: 'Large', systemMessage: 'a'.repeat(1024 * 1024) },
        },
      },
      { oauth: true },
    );
    expect(over.response.status).toBe(413);
    const oauth = await runtime.dispatchFetch('https://mcp.test/oauth/token', {
      method: 'POST',
      headers: {
        'X-Test-OAuth': 'true',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${'a'.repeat(129 * 1024)}`,
    });
    expect(oauth.status).toBe(413);
  });
  await withMcpAuthoring(async (runtime) => {
    const disabled = await mcpRpc(
      runtime,
      'tools/call',
      { name: 'search_content', arguments: { query: 'a'.repeat(129 * 1024) } },
      { oauth: true },
    );
    expect(disabled.response.status).toBe(413);
  }, false);
});
