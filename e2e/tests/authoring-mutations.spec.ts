import { readFile } from 'node:fs/promises';
import type { AuthoringPrincipal } from '../../app/lib/authoring/access.server';
import { getAuthoringChange } from '../../app/lib/authoring/history.server';
import {
  createComposer,
  createPrompt,
  publishComposer,
  publishPrompt,
  restoreAuthoringChange,
  softDeleteComposer,
  softDeletePrompt,
  updateComposer,
  updatePrompt,
} from '../../app/lib/authoring/mutations.server';
import { validateComposer } from '../../app/lib/authoring/previews.server';
import { getComposer, getPrompt } from '../../app/lib/authoring/reads.server';
import { withAuthoringDatabase } from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

const withMutationDatabase = async (run: (db: D1Database) => Promise<void>) =>
  withAuthoringDatabase(async (db) => {
    for (const name of [
      '0011_add_subscription_table.sql',
      '0012_add_organization_id_to_subscription.sql',
      '0024_mcp_connections.sql',
      '0027_authoring_persistence.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      const statements = name.startsWith('0027')
        ? sql.split('--> statement-breakpoint')
        : sql.replaceAll('--> statement-breakpoint', '').split(';');
      await db.batch(
        statements
          .map((statement) => statement.trim())
          .filter(Boolean)
          .map((statement) => db.prepare(statement)),
      );
    }
    await db.batch([
      db.prepare(
        "INSERT INTO member (id,user_id,organization_id,role,created_at) VALUES ('member','alice','workspace','owner',1)",
      ),
      db.prepare(`INSERT INTO mcp_connection (id,user_id,organization_id,membership_id,client_id,client_name,scopes,grant_id,created_at)
      VALUES ('connection','alice','workspace','member','client','Test client','["mcp:read","mcp:write","mcp:publish"]','grant',1)`),
      db.prepare(
        "INSERT INTO subscription (id,user_id,organization_id,plan,status,created_at,updated_at) VALUES ('subscription','alice','workspace','pro','active',1,1)",
      ),
    ]);
    await run(db);
  });

const browser: AuthoringPrincipal = {
  source: 'browser',
  userId: 'alice',
  organizationId: 'workspace',
};
const mcp: AuthoringPrincipal = {
  source: 'mcp',
  userId: 'alice',
  connectionId: 'connection',
  clientId: 'client',
  tokenScopes: ['mcp:read', 'mcp:write', 'mcp:publish'],
};
const readPrompt = (db: D1Database, id: string) =>
  getPrompt(db, {
    organizationId: 'workspace',
    id,
    version: { kind: 'working' },
  });
const readComposer = (db: D1Database, id: string) =>
  getComposer(db, {
    organizationId: 'workspace',
    id,
    version: { kind: 'working' },
  });
const ref = (id: string, pinned?: string) =>
  `<span data-prompt-ref="" data-prompt-id="${id}" data-prompt-name="Reference"${pinned ? ` data-prompt-version-id="${pinned}"` : ''}></span>`;

const beforeCommit = (db: D1Database, run: () => Promise<void>): D1Database => {
  let pending = true;
  return {
    prepare: db.prepare.bind(db),
    batch: db.batch.bind(db),
    exec: db.exec.bind(db),
    dump: db.dump.bind(db),
    withSession: (constraint) => {
      const session = db.withSession(constraint);
      return {
        prepare: session.prepare.bind(session),
        getBookmark: session.getBookmark.bind(session),
        batch: async (statements) => {
          if (pending && statements.length > 10) {
            pending = false;
            await run();
          }
          return session.batch(statements);
        },
      };
    },
  } as D1Database;
};

test('authoring services create full definitions, preserve generated IDs on replay, and snapshot the actual default folder', async () => {
  await withMutationDatabase(async (db) => {
    const input = {
      requestKey: 'create-full',
      definition: {
        name: 'Full prompt',
        systemMessage: `Hello \${customer}`,
        userMessage: 'Instructions',
        labels: 'label',
        config: {
          schema: [{ name: 'customer', type: 'string' }],
          inputData: { customer: 'Sample' },
          custom: { preserved: true },
        },
        snippets: [
          { snippetId: 'other-snippet', snippetVersionId: null, sortOrder: 9 },
          {
            snippetId: 'snippet',
            snippetVersionId: 'snippet-v1',
            sortOrder: 3,
          },
        ],
      },
    };
    const created = await createPrompt(db, mcp, input);
    expect(created.url).toBe(`/prompts/${created.id}`);
    const replay = await createPrompt(db, mcp, input);
    expect(replay).toEqual(created);
    expect(created.assignedIds).toHaveLength(1);
    const saved = await readPrompt(db, created.id);
    expect(saved.definition.config.custom).toEqual({ preserved: true });
    expect(saved.definition.config.schema[0].id).toBe(
      created.assignedIds[0].id,
    );
    expect(saved.definition.labels).toBe('label');
    expect(
      saved.definition.snippets.map((snippet) => snippet.snippetId),
    ).toEqual(['snippet', 'other-snippet']);
    const after = JSON.parse(
      (await db
        .prepare(
          "SELECT definition_json FROM authoring_snapshot WHERE change_id = ? AND phase = 'after'",
        )
        .bind(created.changeId)
        .first<string>('definition_json')) ?? '{}',
    );
    expect(after.folderId).toBe(saved.metadata.folderId);
    expect(after.version.id).toBe(created.versionId);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(1);
  });
});

test('authoring update clones full publication state into one draft and preserves omitted settings, labels, and ordered references', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, browser, {
      requestKey: 'create',
      definition: {
        name: 'Clone complete',
        systemMessage: 'System',
        userMessage: 'User',
        labels: 'keep',
        config: {
          model: 'custom-model',
          temperature: 0.7,
          custom: 'keep',
          inputData: { nested: { keep: 1 } },
        },
        snippets: [
          { snippetId: 'snippet', snippetVersionId: null, sortOrder: 7 },
        ],
      },
    });
    const published = await publishPrompt(db, browser, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'publish',
    });
    expect(published.version).toBe('1.0.0');
    const changed = await updatePrompt(db, browser, {
      id: created.id,
      expectedRevision: published.revision,
      requestKey: 'edit',
      edit: { mode: 'patch', changes: { config: { temperature: 0.2 } } },
    });
    expect(changed.versionId).not.toBe(published.versionId);
    const saved = await readPrompt(db, created.id);
    expect(saved.definition).toMatchObject({
      systemMessage: 'System',
      userMessage: 'User',
      labels: 'keep',
      config: {
        model: 'custom-model',
        temperature: 0.2,
        custom: 'keep',
        inputData: { nested: { keep: 1 } },
      },
      snippets: [
        { snippetId: 'snippet', snippetVersionId: 'snippet-v1', sortOrder: 7 },
      ],
    });
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS count FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL',
        )
        .bind(created.id)
        .first('count'),
    ).toBe(1);
    expect(
      JSON.parse(
        (await db
          .prepare('SELECT config FROM prompt_version WHERE id = ?')
          .bind(published.versionId)
          .first<string>('config')) ?? '{}',
      ).temperature,
    ).toBe(0.7);
  });
});

test('authoring publishes composers without publishing prompt drafts and preserves live versus pinned references', async () => {
  await withMutationDatabase(async (db) => {
    const prompt = await createPrompt(db, mcp, {
      requestKey: 'prompt',
      definition: { name: 'Dependency', systemMessage: 'Text' },
    });
    const composer = await createComposer(db, mcp, {
      requestKey: 'composer',
      definition: { name: 'Composer', content: `<p>${ref(prompt.id)}</p>` },
    });
    expect(
      composer.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing_published_dependency',
      ),
    ).toBe(true);
    await expect(
      publishComposer(db, mcp, {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'blocked',
      }),
    ).rejects.toMatchObject({ code: 'publication_blocked' });
    expect((await readPrompt(db, prompt.id)).version.status).toBe('draft');
    const publication = await publishPrompt(db, mcp, {
      id: prompt.id,
      expectedRevision: prompt.revision,
      requestKey: 'prompt-publication',
    });
    const live = await publishComposer(db, mcp, {
      id: composer.id,
      expectedRevision: composer.revision,
      requestKey: 'composer-publication',
    });
    expect(
      await db
        .prepare(
          'SELECT prompt_version_id,auto_update FROM composer_version_prompt WHERE composer_version_id = ?',
        )
        .bind(live.versionId)
        .first(),
    ).toEqual({ prompt_version_id: null, auto_update: 1 });
    const pinned = await updateComposer(db, mcp, {
      id: composer.id,
      expectedRevision: live.revision,
      requestKey: 'pin',
      edit: {
        mode: 'patch',
        changes: { content: `<p>${ref(prompt.id, publication.versionId)}</p>` },
      },
    });
    const final = await publishComposer(db, mcp, {
      id: composer.id,
      expectedRevision: pinned.revision,
      requestKey: 'pin-publication',
    });
    expect(
      await db
        .prepare(
          'SELECT prompt_version_id,auto_update FROM composer_version_prompt WHERE composer_version_id = ?',
        )
        .bind(final.versionId)
        .first(),
    ).toEqual({ prompt_version_id: publication.versionId, auto_update: 0 });
    expect((await readComposer(db, composer.id)).version.status).toBe(
      'published',
    );
  });
});

test('authoring rejects inaccessible references and pins belonging to another item without creating folders or content', async () => {
  await withMutationDatabase(async (db) => {
    for (const reference of [
      { snippetId: 'foreign-snippet', snippetVersionId: null, sortOrder: 0 },
      {
        snippetId: 'snippet',
        snippetVersionId: 'other-snippet-v1',
        sortOrder: 0,
      },
    ]) {
      await expect(
        createPrompt(db, mcp, {
          requestKey: reference.snippetId,
          definition: { name: 'Invalid', snippets: [reference] },
        }),
      ).rejects.toMatchObject({ code: 'reference_unavailable' });
    }
    await expect(
      createComposer(db, mcp, {
        requestKey: 'foreign',
        definition: {
          name: 'Invalid composer',
          content: ref('foreign-prompt'),
        },
      }),
    ).rejects.toMatchObject({ code: 'reference_unavailable' });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(0);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM prompt_folder')
        .first('count'),
    ).toBe(0);
  });
});

test('authoring repairs a draft by removing a now-deleted reference before validating resulting dependencies', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, mcp, {
      requestKey: 'create',
      definition: {
        name: 'Repair reference',
        snippets: [
          { snippetId: 'snippet', snippetVersionId: null, sortOrder: 0 },
        ],
      },
    });
    await db
      .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
      .run();
    const readable = await readPrompt(db, created.id);
    expect(readable.dependencies).toEqual([]);
    expect(readable.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reference_unavailable' }),
    );
    const fixed = await updatePrompt(db, mcp, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'fix',
      edit: { mode: 'patch', changes: { snippets: [] } },
    });
    expect(fixed.status).toBe('draft');
    expect((await readPrompt(db, created.id)).definition.snippets).toEqual([]);
  });
});

test('authoring saves incomplete drafts, blocks publication until inputs are declared, and accepts empty sample data', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, mcp, {
      requestKey: 'create',
      definition: { name: 'Declare input', systemMessage: `Hello \${name}` },
    });
    expect(
      created.diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    ).toBe(true);
    await expect(
      publishPrompt(db, mcp, {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'blocked',
      }),
    ).rejects.toMatchObject({ code: 'publication_blocked' });
    const repaired = await updatePrompt(db, mcp, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'repair',
      edit: {
        mode: 'patch',
        changes: {
          config: { schema: [{ name: 'name', type: 'string' }], inputData: {} },
        },
      },
    });
    const published = await publishPrompt(db, mcp, {
      id: created.id,
      expectedRevision: repaired.revision,
      requestKey: 'publish',
    });
    expect(published.version).toBe('1.0.0');
    const composer = await createComposer(db, mcp, {
      requestKey: 'composer',
      definition: { name: 'Needs input', content: ref(created.id) },
    });
    expect(
      composer.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing_dependency_input',
      ),
    ).toBe(true);
    await expect(
      publishComposer(db, mcp, {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'composer-blocked',
      }),
    ).rejects.toMatchObject({ code: 'publication_blocked' });
  });
});

test('authoring denies revoked, narrowed, and removed-membership callers before replaying protected results', async () => {
  await withMutationDatabase(async (db) => {
    const input = {
      requestKey: 'protected',
      definition: { name: 'Protected result' },
    };
    const created = await createPrompt(db, mcp, input);
    await expect(
      createPrompt(db, { ...mcp, tokenScopes: ['mcp:read'] }, input),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
    await expect(
      publishPrompt(
        db,
        { ...mcp, tokenScopes: ['mcp:read', 'mcp:write'] },
        {
          id: created.id,
          expectedRevision: created.revision,
          requestKey: 'publish',
        },
      ),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
    await db
      .prepare(
        "UPDATE mcp_connection SET revoked_at = 1 WHERE id = 'connection'",
      )
      .run();
    await expect(createPrompt(db, mcp, input)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    await db.prepare("DELETE FROM member WHERE id = 'member'").run();
    await expect(
      createPrompt(db, browser, {
        requestKey: 'browser',
        definition: { name: 'No membership' },
      }),
    ).rejects.toMatchObject({ code: 'access_denied' });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(1);
  });
});

test('authoring commit rechecks connection scope and reference availability after domain validation', async () => {
  await withMutationDatabase(async (db) => {
    const revoked = beforeCommit(db, async () => {
      await db
        .prepare(
          "UPDATE mcp_connection SET scopes = '[\"mcp:read\"]' WHERE id = 'connection'",
        )
        .run();
    });
    await expect(
      createPrompt(revoked, mcp, {
        requestKey: 'scope-race',
        definition: { name: 'Never saved' },
      }),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(0);
    const removed = beforeCommit(db, async () => {
      await db
        .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
        .run();
    });
    await expect(
      createPrompt(removed, browser, {
        requestKey: 'ref-race',
        definition: {
          name: 'Never saved',
          snippets: [
            { snippetId: 'snippet', snippetVersionId: null, sortOrder: 0 },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'policy_changed' });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM prompt_folder')
        .first('count'),
    ).toBe(0);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_request')
        .first('count'),
    ).toBe(0);
  });
});

test('authoring races at the Free prompt limit atomically and does not invent a composer quota', async () => {
  await withMutationDatabase(async (db) => {
    await db
      .prepare("DELETE FROM subscription WHERE id = 'subscription'")
      .run();
    const attempts = await Promise.allSettled([
      createPrompt(db, browser, {
        requestKey: 'one',
        definition: { name: 'Last free one' },
      }),
      createPrompt(db, browser, {
        requestKey: 'two',
        definition: { name: 'Last free two' },
      }),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    const failed = attempts.find((attempt) => attempt.status === 'rejected');
    expect(failed && 'reason' in failed ? failed.reason : null).toMatchObject({
      code: 'subscription_limit',
    });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt WHERE organization_id = 'workspace' AND deleted_at IS NULL",
        )
        .first('count'),
    ).toBe(3);
    expect(
      (
        await createComposer(db, browser, {
          requestKey: 'composer',
          definition: { name: 'Composer beyond quota' },
        })
      ).status,
    ).toBe('draft');
  });
});

test('authoring keeps expired-trial prompts outside the latest three read-only and blocks stale publish without side effects', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, browser, {
      requestKey: 'editable',
      definition: { name: 'Editable' },
    });
    await db.batch([
      db.prepare(
        "UPDATE subscription SET plan='free',status='expired' WHERE id='subscription'",
      ),
      db.prepare("UPDATE prompt SET updated_at=1 WHERE id='prompt'"),
      db.prepare("UPDATE prompt SET updated_at=2 WHERE id='empty-prompt'"),
      db.prepare(
        "INSERT INTO prompt (id,name,organization_id,created_by,updated_at) VALUES ('third','Third','workspace','alice',3)",
      ),
    ]);
    const old = await readPrompt(db, 'prompt');
    await expect(
      updatePrompt(db, browser, {
        id: 'prompt',
        expectedRevision: old.metadata.revision ?? '',
        requestKey: 'locked',
        edit: { mode: 'patch', changes: { name: 'Locked' } },
      }),
    ).rejects.toMatchObject({ code: 'subscription_limit' });
    const update = await updatePrompt(db, browser, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'update',
      edit: { mode: 'patch', changes: { name: 'Edited' } },
    });
    await expect(
      publishPrompt(db, browser, {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'stale-publish',
      }),
    ).rejects.toMatchObject({
      code: 'stale_revision',
      details: { currentRevision: update.revision },
    });
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS count FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL',
        )
        .bind(created.id)
        .first('count'),
    ).toBe(0);
  });
});

test('authoring soft deletion remains browser owner-only and checks active composer references', async () => {
  await withMutationDatabase(async (db) => {
    const prompt = await createPrompt(db, browser, {
      requestKey: 'prompt',
      definition: { name: 'Deletion target' },
    });
    const input = {
      id: prompt.id,
      expectedRevision: prompt.revision,
      requestKey: 'delete-prompt',
    };
    await expect(softDeletePrompt(db, mcp, input)).rejects.toMatchObject({
      code: 'access_denied',
    });
    await db.prepare("UPDATE member SET role='admin' WHERE id='member'").run();
    await expect(softDeletePrompt(db, browser, input)).rejects.toMatchObject({
      code: 'access_denied',
    });
    await db.prepare("UPDATE member SET role='owner' WHERE id='member'").run();
    const composer = await createComposer(db, browser, {
      requestKey: 'composer',
      definition: { name: 'Blocks deletion', content: ref(prompt.id) },
    });
    await expect(softDeletePrompt(db, browser, input)).rejects.toMatchObject({
      code: 'content_in_use',
    });
    expect(
      (
        await softDeleteComposer(db, browser, {
          id: composer.id,
          expectedRevision: composer.revision,
          requestKey: 'delete-composer',
        })
      ).deleted,
    ).toBe(true);
    const deleted = await softDeletePrompt(db, browser, input);
    expect(deleted.deleted).toBe(true);
    expect(await softDeletePrompt(db, browser, input)).toEqual(deleted);
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_outbox WHERE json_extract(payload_json,'$.allVersions') = 1",
        )
        .first('count'),
    ).toBe(2);
  });
});

test('authoring concurrent creates with generated fields replay one schema mapping and preserve existing naming rules', async () => {
  await withMutationDatabase(async (db) => {
    const input = {
      requestKey: 'concurrent',
      definition: {
        name: 'Same name',
        config: { schema: [{ name: 'value', type: 'string' }] },
      },
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => createPrompt(db, mcp, input)),
    );
    for (const result of results) expect(result).toEqual(results[0]);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(1);
    expect(
      (
        await createPrompt(db, mcp, {
          ...input,
          requestKey: 'different-operation',
        })
      ).id,
    ).not.toBe(results[0].id);
    await createComposer(db, mcp, {
      requestKey: 'composer-one',
      definition: { name: 'Unique composer' },
    });
    await expect(
      createComposer(db, mcp, {
        requestKey: 'composer-two',
        definition: { name: 'Unique composer' },
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});

test('authoring publication guards reject loss of an unpinned dependency publication after validation', async () => {
  await withMutationDatabase(async (db) => {
    const prompt = await createPrompt(db, browser, {
      requestKey: 'prompt',
      definition: { name: 'Dependency publication' },
    });
    const publication = await publishPrompt(db, browser, {
      id: prompt.id,
      expectedRevision: prompt.revision,
      requestKey: 'publish',
    });
    const composer = await createComposer(db, browser, {
      requestKey: 'composer',
      definition: { name: 'Guard publication', content: ref(prompt.id) },
    });
    const raced = beforeCommit(db, async () => {
      await db
        .prepare('DELETE FROM prompt_version WHERE id = ?')
        .bind(publication.versionId)
        .run();
    });
    await expect(
      publishComposer(raced, browser, {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'must-not-publish',
      }),
    ).rejects.toMatchObject({ code: 'policy_changed' });
    expect(
      await db
        .prepare('SELECT published_at FROM composer_version WHERE id = ?')
        .bind(composer.versionId)
        .first('published_at'),
    ).toBeNull();
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE request_key = 'must-not-publish'",
        )
        .first('count'),
    ).toBe(0);
  });
});

test('authoring deletion guards reject a composer reference inserted after initial authorization', async () => {
  await withMutationDatabase(async (db) => {
    const prompt = await createPrompt(db, browser, {
      requestKey: 'prompt',
      definition: { name: 'Delete race' },
    });
    const raced = beforeCommit(db, async () => {
      await db
        .prepare(
          "INSERT INTO composer_version_prompt (id,composer_version_id,prompt_id,auto_update) VALUES ('race','composer-draft',?,1)",
        )
        .bind(prompt.id)
        .run();
    });
    await expect(
      softDeletePrompt(raced, browser, {
        id: prompt.id,
        expectedRevision: prompt.revision,
        requestKey: 'must-not-delete',
      }),
    ).rejects.toMatchObject({ code: 'policy_changed' });
    expect(
      await db
        .prepare('SELECT deleted_at FROM prompt WHERE id = ?')
        .bind(prompt.id)
        .first('deleted_at'),
    ).toBeNull();
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE request_key = 'must-not-delete'",
        )
        .first('count'),
    ).toBe(0);
  });
});

test('authoring restore preserves full prompt snapshots and publications, then replays before stale and expired history checks', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, mcp, {
      requestKey: 'original',
      definition: {
        name: 'Restore original',
        description: 'Original description',
        labels: 'original-label',
        systemMessage: 'Original system',
        userMessage: 'Original user',
        config: {
          schema: [{ name: 'customer', type: 'string' }],
          inputData: { customer: 'Original sample' },
          custom: { preserved: true },
        },
        snippets: [
          {
            snippetId: 'snippet',
            snippetVersionId: 'snippet-v1',
            sortOrder: 0,
          },
          { snippetId: 'other-snippet', sortOrder: 1 },
        ],
      },
    });
    const original = await readPrompt(db, created.id);
    const edited = await updatePrompt(db, mcp, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'edit',
      folderId: null,
      edit: {
        mode: 'patch',
        changes: {
          name: 'Published replacement',
          systemMessage: 'Published system',
        },
      },
    });
    const published = await publishPrompt(db, mcp, {
      id: created.id,
      expectedRevision: edited.revision,
      requestKey: 'publish',
    });
    const input = {
      kind: 'prompt' as const,
      id: created.id,
      expectedRevision: published.revision,
      requestKey: 'restore',
      changeId: created.changeId,
      phase: 'after' as const,
    };
    const restored = await restoreAuthoringChange(db, mcp, input);
    const current = await readPrompt(db, created.id);
    expect(current.definition).toEqual(original.definition);
    expect(current.metadata.folderId).toEqual(original.metadata.folderId);
    expect(restored.status).toBe('draft');
    expect(restored.versionId).not.toBe(published.versionId);
    expect(restored.assignedIds).toEqual([]);
    expect(
      await db
        .prepare('SELECT system_message FROM prompt_version WHERE id = ?')
        .bind(published.versionId)
        .first('system_message'),
    ).toBe('Published system');
    const history = await getAuthoringChange(db, mcp, {
      changeId: restored.changeId,
    });
    expect(history.change.operation).toBe('restore_prompt');
    expect(history.before?.version.status).toBe('published');
    expect(history.after.definition).toEqual(original.definition);
    const advanced = await updatePrompt(db, browser, {
      id: restored.id,
      expectedRevision: restored.revision,
      requestKey: 'advance',
      edit: { mode: 'patch', changes: { systemMessage: 'Later edit' } },
    });
    await db
      .prepare('UPDATE authoring_change SET expires_at = 1 WHERE id = ?')
      .bind(created.changeId)
      .run();
    expect(await restoreAuthoringChange(db, mcp, input)).toEqual(restored);
    expect((await readPrompt(db, created.id)).metadata.revision).toBe(
      advanced.revision,
    );
    await expect(
      restoreAuthoringChange(db, mcp, { ...input, phase: 'before' }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    await db
      .prepare(
        "UPDATE mcp_connection SET revoked_at = 1 WHERE id = 'connection'",
      )
      .run();
    await expect(restoreAuthoringChange(db, mcp, input)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
  });
});

test('authoring restore uses composer before snapshots without changing published history or creating a second draft', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createComposer(db, browser, {
      requestKey: 'composer',
      definition: {
        name: 'Restore composer',
        content: `<p>Original</p>${ref('prompt', 'prompt-v1')}`,
        config: {
          schema: [{ name: 'customer', type: 'string' }],
          inputData: { customer: 'Example' },
        },
      },
    });
    const published = await publishComposer(db, browser, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'publish',
    });
    const edited = await updateComposer(db, browser, {
      id: created.id,
      expectedRevision: published.revision,
      requestKey: 'edit',
      edit: { mode: 'patch', changes: { content: '<p>Replacement</p>' } },
    });
    const restored = await restoreAuthoringChange(db, browser, {
      kind: 'composer',
      id: created.id,
      expectedRevision: edited.revision,
      requestKey: 'restore-before',
      changeId: edited.changeId,
      phase: 'before',
    });
    expect(restored.versionId).toBe(edited.versionId);
    const working = await readComposer(db, created.id);
    expect(working.definition.content).toBe(
      `<p>Original</p>${ref('prompt', 'prompt-v1')}`,
    );
    expect(working.dependencies[0].resolvedVersionId).toBe('prompt-v1');
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS count FROM composer_version WHERE composer_id = ? AND published_at IS NULL',
        )
        .bind(created.id)
        .first('count'),
    ).toBe(1);
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS count FROM composer_version WHERE composer_id = ? AND published_at IS NOT NULL',
        )
        .bind(created.id)
        .first('count'),
    ).toBe(1);
  });
});

test('authoring restore rejects unavailable states, other documents, and references that are no longer accessible', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, browser, {
      requestKey: 'original',
      definition: {
        name: 'Restore restrictions',
        snippets: [{ snippetId: 'snippet', sortOrder: 0 }],
      },
    });
    const base = {
      kind: 'prompt' as const,
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'restore',
      changeId: created.changeId,
      phase: 'after' as const,
    };
    await expect(
      restoreAuthoringChange(db, browser, { ...base, phase: 'before' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      restoreAuthoringChange(db, browser, { ...base, id: 'prompt' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    const edited = await updatePrompt(db, browser, {
      id: created.id,
      expectedRevision: created.revision,
      requestKey: 'detach',
      edit: { mode: 'patch', changes: { snippets: [] } },
    });
    await db
      .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
      .run();
    await expect(
      restoreAuthoringChange(db, browser, {
        ...base,
        expectedRevision: edited.revision,
      }),
    ).rejects.toMatchObject({ code: 'reference_unavailable' });
    expect((await readPrompt(db, created.id)).metadata.revision).toBe(
      edited.revision,
    );
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE operation = 'restore_prompt'",
        )
        .first('count'),
    ).toBe(0);
  });
});

test('authoring browser mutations reject a duplicated workspace membership inserted before commit', async () => {
  await withMutationDatabase(async (db) => {
    const created = await createPrompt(db, browser, {
      requestKey: 'create',
      definition: { name: 'Membership race' },
    });
    const raced = beforeCommit(db, async () => {
      await db
        .prepare(
          "INSERT INTO member (id,user_id,organization_id,role,created_at) VALUES ('duplicate-member','alice','workspace','member',1)",
        )
        .run();
    });
    await expect(
      updatePrompt(raced, browser, {
        id: created.id,
        expectedRevision: created.revision,
        requestKey: 'must-not-save',
        edit: {
          mode: 'patch',
          changes: { systemMessage: 'Unauthorized ambiguity' },
        },
      }),
    ).rejects.toMatchObject({ code: 'access_denied' });
    expect((await readPrompt(db, created.id)).metadata.revision).toBe(
      created.revision,
    );
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE request_key = 'must-not-save'",
        )
        .first('count'),
    ).toBe(0);
  });
});

test('composer publication and validation agree on invalid published prompt structure and missing snippet publications', async () => {
  await withMutationDatabase(async (db) => {
    await db
      .prepare(
        "UPDATE prompt_version SET system_message = ? WHERE id = 'prompt-v2'",
      )
      .bind(`\${missing}`)
      .run();
    await db
      .prepare("DELETE FROM snippet_version WHERE id = 'other-snippet-v1'")
      .run();
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet (id,prompt_version_id,snippet_id,sort_order) VALUES ('legacy-reference','prompt-v2','other-snippet',0)",
      )
      .run();
    const composer = await createComposer(db, browser, {
      requestKey: 'legacy',
      definition: { name: 'Legacy dependencies', content: ref('prompt') },
    });
    expect(
      composer.diagnostics.some(
        (entry) => entry.code === 'missing_published_dependency',
      ),
    ).toBe(true);
    expect(
      composer.diagnostics.some(
        (entry) => entry.code === 'undeclared_variable',
      ),
    ).toBe(true);
    await expect(
      publishComposer(db, browser, {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'blocked',
      }),
    ).rejects.toMatchObject({ code: 'publication_blocked' });
    const validation = await validateComposer(db, {
      organizationId: 'workspace',
      id: composer.id,
      version: { kind: 'working' },
    });
    expect(validation.valid).toBe(false);
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining(composer.diagnostics),
    );
    expect(
      (
        await getPrompt(db, {
          organizationId: 'workspace',
          id: 'prompt',
          version: { kind: 'latest' },
        })
      ).definition.systemMessage,
    ).toBe(`\${missing}`);
  });
});

test('composer publication rechecks expanded snippet access after complete readiness validation', async () => {
  await withMutationDatabase(async (db) => {
    const prompt = await createPrompt(db, browser, {
      requestKey: 'prompt',
      definition: {
        name: 'Expanded guards',
        snippets: [{ snippetId: 'snippet', sortOrder: 0 }],
      },
    });
    await publishPrompt(db, browser, {
      id: prompt.id,
      expectedRevision: prompt.revision,
      requestKey: 'publish-prompt',
    });
    const composer = await createComposer(db, browser, {
      requestKey: 'composer',
      definition: { name: 'Expanded race', content: ref(prompt.id) },
    });
    const raced = beforeCommit(db, async () => {
      await db
        .prepare("UPDATE snippet SET deleted_at = 1 WHERE id = 'snippet'")
        .run();
    });
    await expect(
      publishComposer(raced, browser, {
        id: composer.id,
        expectedRevision: composer.revision,
        requestKey: 'blocked',
      }),
    ).rejects.toMatchObject({ code: 'policy_changed' });
    expect(
      await db
        .prepare('SELECT published_at FROM composer_version WHERE id = ?')
        .bind(composer.versionId)
        .first('published_at'),
    ).toBeNull();
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE request_key = 'blocked'",
        )
        .first('count'),
    ).toBe(0);
  });
});

test('composer validation and authoring bound aggregate referenced definitions before loading their bodies', async () => {
  await withMutationDatabase(async (db) => {
    const ids = Array.from({ length: 10 }, (_, index) => `large-${index}`);
    await db.batch(
      ids.flatMap((id) => [
        db
          .prepare(
            "INSERT INTO prompt (id,name,organization_id,created_by) VALUES (?,?,'workspace','alice')",
          )
          .bind(id, id),
        db
          .prepare(
            "INSERT INTO prompt_version (id,prompt_id,major,minor,patch,system_message,config,created_by,published_at) VALUES (?,?,1,0,0,?,'{}','alice',1)",
          )
          .bind(`${id}-v1`, id, 'x'.repeat(230000)),
      ]),
    );
    const content = ids.map((id) => ref(id)).join('');
    await expect(
      createComposer(db, browser, {
        requestKey: 'too-large',
        definition: { name: 'Too much expanded content', content },
      }),
    ).rejects.toMatchObject({ code: 'payload_too_large' });
    await db
      .prepare(
        "UPDATE composer_version SET content = ? WHERE id = 'composer-draft'",
      )
      .bind(content)
      .run();
    await db.batch(
      ids.map((id) =>
        db
          .prepare(
            "INSERT INTO composer_version_prompt (id,composer_version_id,prompt_id,auto_update) VALUES (?,'composer-draft',?,1)",
          )
          .bind(`${id}-ref`, id),
      ),
    );
    await expect(
      validateComposer(db, {
        organizationId: 'workspace',
        id: 'composer',
        version: { kind: 'working' },
      }),
    ).rejects.toMatchObject({ code: 'payload_too_large' });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM authoring_request WHERE request_key = 'too-large'",
        )
        .first('count'),
    ).toBe(0);
  });
});
