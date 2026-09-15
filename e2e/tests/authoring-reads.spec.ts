import {
  getComposer,
  getPrompt,
  getSnippet,
  listAvailableModels,
  listVersions,
  readComposerDefinition,
  readPromptDefinition,
  resolveAuthoringDependencies,
} from '../../app/lib/authoring/reads.server';
import { withAuthoringDatabase } from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

test('authoring reads select exact draft and published versions with current parent metadata', async () => {
  await withAuthoringDatabase(async (db) => {
    const target = { organizationId: 'workspace', id: 'prompt' };
    const draft = await getPrompt(db, {
      ...target,
      version: { kind: 'draft' },
    });
    const latest = await getPrompt(db, {
      ...target,
      version: { kind: 'latest' },
    });
    const historical = await getPrompt(db, {
      ...target,
      version: { kind: 'published', version: '1.0.0' },
    });
    const byId = await getPrompt(db, {
      ...target,
      version: { kind: 'published', versionId: 'prompt-v1' },
    });
    const working = await getPrompt(db, {
      ...target,
      version: { kind: 'working' },
    });
    expect(draft.version).toMatchObject({
      id: 'prompt-draft',
      status: 'draft',
      version: null,
    });
    expect(working.version).toEqual(draft.version);
    expect(latest.version).toMatchObject({
      id: 'prompt-v2',
      status: 'published',
      version: '2.0.0',
    });
    expect(historical).toEqual(byId);
    expect(historical.definition).toMatchObject({
      name: 'Current prompt name',
      description: 'Current description',
      systemMessage: 'First publication',
    });
    expect(latest.definition.labels).toBe('saved-label');
    expect(latest.metadata).toEqual({
      id: 'prompt',
      organizationId: 'workspace',
      kind: 'prompt',
      folderId: null,
      revision: null,
    });
    expect(JSON.stringify(draft)).not.toContain('987654');
    expect(JSON.stringify(draft)).not.toContain('last_output_tokens');
    await db
      .prepare("DELETE FROM prompt_version WHERE id = 'prompt-draft'")
      .run();
    expect(
      (await getPrompt(db, { ...target, version: { kind: 'working' } })).version
        .id,
    ).toBe('prompt-v2');
    await expect(
      getPrompt(db, { ...target, version: { kind: 'draft' } }),
    ).rejects.toMatchObject({ code: 'version_not_found' });
  });
});

test('authoring reads never fall back from missing or inaccessible explicit selections', async () => {
  await withAuthoringDatabase(async (db) => {
    for (const id of ['missing', 'foreign-prompt', 'deleted-prompt']) {
      await expect(
        getPrompt(db, {
          organizationId: 'workspace',
          id,
          version: { kind: 'working' },
        }),
      ).rejects.toMatchObject({
        code: 'content_not_found',
        message: 'Content not found in this workspace.',
      });
    }
    for (const versionId of ['missing', 'foreign-prompt-v1', 'prompt-draft']) {
      await expect(
        getPrompt(db, {
          organizationId: 'workspace',
          id: 'prompt',
          version: { kind: 'published', versionId },
        }),
      ).rejects.toMatchObject({ code: 'version_not_found' });
    }
    await expect(
      getPrompt(db, {
        organizationId: 'workspace',
        id: 'prompt',
        version: { kind: 'published', version: '9.9.9' },
      }),
    ).rejects.toMatchObject({ code: 'version_not_found' });
    await expect(
      getPrompt(db, {
        organizationId: 'workspace',
        id: 'empty-prompt',
        version: { kind: 'working' },
      }),
    ).rejects.toMatchObject({ code: 'version_not_found' });
    await expect(
      getComposer(db, {
        organizationId: 'workspace',
        id: 'composer',
        version: { kind: 'latest' },
      }),
    ).rejects.toMatchObject({ code: 'version_not_found' });
    await expect(
      getComposer(db, {
        organizationId: 'workspace',
        id: 'foreign-composer',
        version: { kind: 'draft' },
      }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
    await expect(
      getSnippet(db, {
        organizationId: 'workspace',
        id: 'foreign-snippet',
        version: { kind: 'latest' },
      }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
  });
});

test('authoring version lists paginate deterministically without exposing content', async () => {
  await withAuthoringDatabase(async (db) => {
    const target = {
      organizationId: 'workspace',
      id: 'prompt',
      kind: 'prompt' as const,
      limit: 2,
    };
    const first = await listVersions(db, target);
    expect(first.items.map((version) => version.id)).toEqual([
      'prompt-draft',
      'prompt-v2',
    ]);
    expect(first.nextOffset).toBe(2);
    const second = await listVersions(db, {
      ...target,
      offset: first.nextOffset ?? 0,
    });
    expect(second.items.map((version) => version.id)).toEqual(['prompt-v1']);
    expect(second.nextOffset).toBeNull();
    expect(JSON.stringify(first)).not.toContain('Draft system');
    expect(await listVersions(db, { ...target, id: 'empty-prompt' })).toEqual({
      items: [],
      nextOffset: null,
    });
    await expect(
      listVersions(db, { ...target, id: 'foreign-prompt' }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
  });
});

test('authoring reads preserve legacy saved settings and never generate IDs while reading', async () => {
  await withAuthoringDatabase(async (db) => {
    const config = {
      schema: [
        {
          id: 'legacy-id',
          name: 'value',
          type: 'custom',
          validations: [
            {
              id: 'legacy-rule',
              type: 'transform',
              value: 'legacy code',
              message: '',
              futureRule: { enabled: true },
            },
          ],
          params: { required_error: 'Required', futureParam: ['keep'] },
          futureField: true,
        },
      ],
      inputData: ['sample'],
      inputDataRootName: 'values',
      providerOptions: { experimental: true },
    };
    const raw = JSON.stringify(config);
    await db
      .prepare("UPDATE prompt_version SET config = ? WHERE id = 'prompt-draft'")
      .bind(raw)
      .run();
    const target = {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'draft' as const },
    };
    const read = await getPrompt(db, target);
    expect(read.definition.config).toMatchObject(config);
    expect(await getPrompt(db, target)).toEqual(read);
    expect(
      await db
        .prepare("SELECT config FROM prompt_version WHERE id = 'prompt-draft'")
        .first('config'),
    ).toBe(raw);
    for (const invalid of [
      '{broken',
      JSON.stringify({ schema: [{ name: 'missing ID', type: 'string' }] }),
    ]) {
      await db
        .prepare(
          "UPDATE prompt_version SET config = ? WHERE id = 'prompt-draft'",
        )
        .bind(invalid)
        .run();
      await expect(getPrompt(db, target)).rejects.toMatchObject({
        code: 'invalid_stored_definition',
      });
      expect(
        await db
          .prepare(
            "SELECT config FROM prompt_version WHERE id = 'prompt-draft'",
          )
          .first('config'),
      ).toBe(invalid);
    }
  });
});

test('authoring snippet reads preserve repairable references while mutations reject inaccessible or mismatched pins', async () => {
  await withAuthoringDatabase(async (db) => {
    await db.batch([
      db.prepare(
        "INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, snippet_version_id, sort_order) VALUES ('ref-first', 'prompt-draft', 'snippet', NULL, 4)",
      ),
      db.prepare(
        "INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, snippet_version_id, sort_order) VALUES ('ref-second', 'prompt-draft', 'other-snippet', 'other-snippet-v1', 2)",
      ),
    ]);
    const target = {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'draft' as const },
    };
    const read = await getPrompt(db, target);
    expect(read.definition.snippets).toEqual([
      {
        snippetId: 'other-snippet',
        snippetVersionId: 'other-snippet-v1',
        sortOrder: 2,
      },
      { snippetId: 'snippet', snippetVersionId: null, sortOrder: 4 },
    ]);
    expect(
      read.dependencies.map((reference) => reference.resolvedVersionId),
    ).toEqual(['other-snippet-v1', 'snippet-v1']);
    expect(read.diagnostics).toEqual([]);
    for (const pin of [
      'other-snippet-v1',
      'snippet-draft',
      'foreign-snippet-v1',
    ]) {
      await db
        .prepare(
          "UPDATE prompt_version_snippet SET snippet_version_id = ? WHERE id = 'ref-first'",
        )
        .bind(pin)
        .run();
      const inspectable = await getPrompt(db, target);
      expect(inspectable.definition.snippets[1]?.snippetVersionId).toBe(pin);
      expect(inspectable.dependencies.map((item) => item.id)).toEqual([
        'other-snippet',
      ]);
      expect(inspectable.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'reference_unavailable',
          path: ['references', 1],
        }),
      );
      expect(JSON.stringify(inspectable)).not.toContain('Private snippet');
      await expect(
        resolveAuthoringDependencies(
          db.withSession('first-primary'),
          'workspace',
          'snippet',
          [{ id: 'snippet', pinnedVersionId: pin }],
        ),
      ).rejects.toMatchObject({ code: 'reference_unavailable' });
    }
    await db
      .prepare(
        "UPDATE prompt_version_snippet SET snippet_id = 'foreign-snippet', snippet_version_id = NULL WHERE id = 'ref-first'",
      )
      .run();
    const unavailable = await getPrompt(db, target);
    expect(unavailable.definition.snippets[1]?.snippetId).toBe(
      'foreign-snippet',
    );
    expect(unavailable.dependencies.map((item) => item.id)).toEqual([
      'other-snippet',
    ]);
    expect(JSON.stringify(unavailable)).not.toContain('Private snippet');
    await db
      .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'other-snippet'")
      .run();
    const deleted = await getPrompt(db, target);
    expect(deleted.dependencies).toEqual([]);
    expect(
      deleted.diagnostics.filter(
        (entry) => entry.code === 'reference_unavailable',
      ),
    ).toHaveLength(2);
    const snippet = await getSnippet(db, {
      organizationId: 'workspace',
      id: 'snippet',
      version: { kind: 'draft' },
    });
    expect(snippet.definition.content).toBe('Snippet draft');
    expect(
      (
        await getSnippet(db, {
          organizationId: 'workspace',
          id: 'snippet',
          version: { kind: 'latest' },
        })
      ).definition.content,
    ).toBe('Published snippet');
  });
});

test('authoring composer reads validate both HTML references and the saved reference index', async () => {
  await withAuthoringDatabase(async (db) => {
    const target = {
      organizationId: 'workspace',
      id: 'composer',
      version: { kind: 'draft' as const },
    };
    const content =
      '<p><span data-prompt-ref="" data-prompt-id="prompt"></span></p>';
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind(content)
      .run();
    const missingIndex = await getComposer(db, target);
    expect(missingIndex.definition.content).toBe(content);
    expect(missingIndex.dependencies).toMatchObject([
      { id: 'prompt', pinnedVersionId: null, resolvedVersionId: 'prompt-v2' },
    ]);
    expect(
      missingIndex.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(['reference_index_mismatch']);
    await db
      .prepare(
        "INSERT INTO composer_version_prompt (id, composer_version_id, prompt_id, prompt_version_id, auto_update) VALUES ('composer-ref', 'composer-draft', 'prompt', NULL, 1)",
      )
      .run();
    expect((await getComposer(db, target)).diagnostics).toEqual([]);
    await db
      .prepare(
        "UPDATE composer_version_prompt SET prompt_id = 'foreign-prompt' WHERE id = 'composer-ref'",
      )
      .run();
    const foreignIndex = await getComposer(db, target);
    expect(foreignIndex.dependencies.map((item) => item.id)).toEqual([
      'prompt',
    ]);
    expect(foreignIndex.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'reference_unavailable',
        path: ['storedReferences', 0],
      }),
    );
    expect(JSON.stringify(foreignIndex)).not.toContain('Private foreign');
    await db
      .prepare("DELETE FROM composer_version_prompt WHERE id = 'composer-ref'")
      .run();
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind('<span data-prompt-ref="" data-prompt-id="foreign-prompt"></span>')
      .run();
    const foreignHtml = await getComposer(db, target);
    expect(foreignHtml.definition.content).toContain('foreign-prompt');
    expect(foreignHtml.dependencies).toEqual([]);
    expect(foreignHtml.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reference_unavailable' }),
    );
    expect(JSON.stringify(foreignHtml)).not.toContain('Private foreign');
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind('<span data-prompt-ref="" data-prompt-id="empty-prompt"></span>')
      .run();
    const incomplete = await getComposer(db, target);
    expect(incomplete.dependencies[0].resolvedVersionId).toBeNull();
    expect(
      incomplete.diagnostics.map((diagnostic) => diagnostic.code),
    ).toContain('missing_published_dependency');
  });
});

test('authoring model lists expose only enabled workspace models and public metadata', async () => {
  await withAuthoringDatabase(async (db) => {
    for (const [id, org, provider, models] of [
      ['first', 'workspace', 'openai', ['gpt-5.5', 'custom-future-model']],
      ['second', 'workspace', 'openai', ['gpt-5.5']],
      ['disabled', 'workspace', 'anthropic', []],
      ['foreign', 'foreign', 'google', ['gemini-foreign-only']],
    ] as const) {
      await db
        .prepare(
          'INSERT INTO llm_api_key (id, organization_id, name, provider, encrypted_key, key_hint, enabled_models, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          org,
          'Private key label',
          provider,
          'fake-encrypted-test-value',
          'fake-hint',
          JSON.stringify(models),
          'alice',
          1,
          1,
        )
        .run();
    }
    const first = await listAvailableModels(db, {
      organizationId: 'workspace',
      limit: 1,
    });
    expect(first.items).toEqual([
      {
        id: 'custom-future-model',
        displayName: 'custom-future-model',
        provider: 'openai',
      },
    ]);
    expect(first.nextOffset).toBe(1);
    const second = await listAvailableModels(db, {
      organizationId: 'workspace',
      offset: first.nextOffset ?? 0,
      limit: 1,
    });
    expect(second.items[0]).toMatchObject({
      id: 'gpt-5.5',
      provider: 'openai',
    });
    expect(second.nextOffset).toBeNull();
    const all = await listAvailableModels(db, { organizationId: 'workspace' });
    expect(all.items).toHaveLength(2);
    for (const secret of [
      'fake-encrypted-test-value',
      'fake-hint',
      'Private key label',
      'gemini-foreign-only',
    ])
      expect(JSON.stringify(all)).not.toContain(secret);
  });
});

test('authoring reads reject duplicate drafts instead of arbitrarily choosing one', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "INSERT INTO prompt_version (id, prompt_id, config, created_by) VALUES ('extra-draft', 'prompt', '{}', 'alice')",
      )
      .run();
    for (const kind of ['draft', 'working'] as const)
      await expect(
        getPrompt(db, {
          organizationId: 'workspace',
          id: 'prompt',
          version: { kind },
        }),
      ).rejects.toMatchObject({ code: 'duplicate_drafts' });
    expect(
      (
        await getPrompt(db, {
          organizationId: 'workspace',
          id: 'prompt',
          version: { kind: 'latest' },
        })
      ).version.id,
    ).toBe('prompt-v2');
  });
});

test('internal authoring snapshots allow unavailable references to be removed while retaining workspace checks', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, sort_order) VALUES ('broken', 'prompt-draft', 'snippet', 0)",
      )
      .run();
    await db
      .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
      .run();
    const promptInput = {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'working' as const },
    };
    expect((await getPrompt(db, promptInput)).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reference_unavailable' }),
    );
    const source = await readPromptDefinition(db, promptInput);
    expect(source.definition.snippets[0].snippetId).toBe('snippet');
    expect(source.metadata.organizationId).toBe('workspace');
    await expect(
      readPromptDefinition(db, { ...promptInput, organizationId: 'foreign' }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind('<span data-prompt-ref="" data-prompt-id="deleted-prompt"></span>')
      .run();
    const composerInput = {
      organizationId: 'workspace',
      id: 'composer',
      version: { kind: 'working' as const },
    };
    expect((await getComposer(db, composerInput)).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reference_unavailable' }),
    );
    expect(
      (await readComposerDefinition(db, composerInput)).promptReferences,
    ).toMatchObject([{ promptId: 'deleted-prompt' }]);
    await expect(
      readComposerDefinition(db, {
        ...composerInput,
        organizationId: 'foreign',
      }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
  });
});

test('authoring rejects corrupt direct publication metadata and reports corrupt dependencies for repair', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "UPDATE snippet_version SET minor = NULL WHERE id = 'snippet-v1'",
      )
      .run();
    await expect(
      getSnippet(db, {
        organizationId: 'workspace',
        id: 'snippet',
        version: { kind: 'latest' },
      }),
    ).rejects.toMatchObject({ code: 'invalid_stored_definition' });
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, sort_order) VALUES ('invalid-publication', 'prompt-draft', 'snippet', 0)",
      )
      .run();
    const repairable = await getPrompt(db, {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'draft' },
    });
    expect(repairable.dependencies).toEqual([]);
    expect(repairable.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'invalid_stored_definition' }),
    );
    await expect(
      resolveAuthoringDependencies(
        db.withSession('first-primary'),
        'workspace',
        'snippet',
        [{ id: 'snippet', pinnedVersionId: null }],
      ),
    ).rejects.toMatchObject({ code: 'invalid_stored_definition' });
  });
});
