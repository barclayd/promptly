import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import {
  AUTHORING_HISTORY_WINDOW_MS,
  AUTHORING_RETRY_WINDOW_MS,
  type AuthoringCommitActor,
  type AuthoringCommitInput,
  type AuthoringPreparedCommit,
  type AuthoringWrite,
  cleanupAuthoringPersistence,
  commitAuthoringMutation,
  readAuthoringReplay,
} from '../../app/lib/authoring/persistence.server';
import { expect, test } from '../fixtures/base';

const migration = async (db: D1Database, name: string) => {
  const sql = await readFile(
    new URL(`../../migrations/drizzle/${name}`, import.meta.url),
    'utf8',
  );
  const statements = name.startsWith('0027')
    ? sql.split('--> statement-breakpoint')
    : sql.replaceAll('--> statement-breakpoint', '').split(';');
  await db.batch(
    statements
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s)),
  );
};

const withDatabase = async (
  run: (db: D1Database) => Promise<void>,
  migrate = true,
) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default { fetch: () => new Response("Authoring persistence test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
      '0002_prompt_table.sql',
      '0003_add_published_at.sql',
      '0004_allow_null_version.sql',
      '0005_semver_columns.sql',
      '0006_add_updated_at.sql',
      '0007_add_published_by.sql',
      '0014_drop_prompt_name_unique.sql',
      '0018_add_snippet_tables.sql',
      '0019_add_composer_tables.sql',
      '0020_add_snippet_sort_order.sql',
      '0024_mcp_connections.sql',
    ])
      await migration(db, name);
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.com')",
      ),
      db.prepare(`INSERT INTO organization (id, name, slug, created_at) VALUES
        ('workspace', 'Workspace', 'workspace', 1), ('other', 'Other', 'other', 1)`),
      db.prepare(`INSERT INTO member (id, organization_id, user_id, created_at) VALUES
        ('member', 'workspace', 'alice', 1), ('other-member', 'other', 'alice', 1)`),
      db.prepare(`INSERT INTO mcp_connection
        (id, user_id, organization_id, membership_id, client_id, client_name, scopes, created_at) VALUES
        ('connection', 'alice', 'workspace', 'member', 'test-client', 'Test Client', '["mcp:write"]', 1),
        ('second', 'alice', 'workspace', 'member', 'test-client', 'Test Client', '["mcp:write"]', 1)`),
      db.prepare(`INSERT INTO prompt (id, name, organization_id, created_by) VALUES
        ('prompt', 'Original', 'workspace', 'alice'), ('other-prompt', 'Other', 'other', 'alice')`),
      db.prepare(`INSERT INTO prompt_version (id, prompt_id, system_message, config, created_by) VALUES
        ('draft', 'prompt', 'Original content', '{}', 'alice'),
        ('other-draft', 'other-prompt', 'Other content', '{}', 'alice')`),
      db.prepare(`INSERT INTO snippet (id, name, organization_id, created_by) VALUES
        ('original', 'Original', 'workspace', 'alice'), ('one', 'One', 'workspace', 'alice'),
        ('two', 'Two', 'workspace', 'alice')`),
      db.prepare(`INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id)
        VALUES ('old-ref', 'draft', 'original')`),
      db.prepare(`INSERT INTO composer (id, name, organization_id, created_by)
        VALUES ('composer', 'Composer', 'workspace', 'alice')`),
      db.prepare(`INSERT INTO composer_version (id, composer_id, content, created_by)
        VALUES ('composer-draft', 'composer', '<p>Original</p>', 'alice')`),
    ]);
    if (migrate) await migration(db, '0027_authoring_persistence.sql');
    await run(db);
  } finally {
    await runtime.dispose();
  }
};

const actor: AuthoringCommitActor = {
  source: 'mcp',
  organizationId: 'workspace',
  userId: 'alice',
  name: 'Alice',
  connectionId: 'connection',
  clientId: 'test-client',
  clientName: 'Test Client',
};
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
type SavedResult = { revision: string; changeId: string; name: string };

const edit = (
  revision: string,
  key: string,
  name: string,
  options: Partial<AuthoringCommitInput<SavedResult>> = {},
): AuthoringCommitInput<SavedResult> => ({
  actor,
  operation: 'update_prompt',
  requestKey: key,
  requestHash: hash({ documentId: 'prompt', revision, name }),
  target: { kind: 'prompt', documentId: 'prompt', expectedRevision: revision },
  guards: [
    { sql: 'EXISTS (SELECT 1 FROM member WHERE id = ?)', values: ['member'] },
  ],
  prepare: ({
    revision: next,
    changeId,
  }): AuthoringPreparedCommit<SavedResult> => ({
    writes: [
      {
        kind: 'update',
        table: 'prompt',
        set: { name },
        where: { sql: 'id = ?', values: ['prompt'] },
        expectedChanges: 1,
      },
      {
        kind: 'update',
        table: 'prompt_version',
        set: { system_message: name },
        where: { sql: 'id = ?', values: ['draft'] },
        expectedChanges: 1,
      },
      {
        kind: 'delete',
        table: 'prompt_version_snippet',
        where: { sql: 'prompt_version_id = ?', values: ['draft'] },
        expectedChanges: { min: 0, max: 100 },
      },
      {
        kind: 'insert',
        table: 'prompt_version_snippet',
        columns: ['id', 'prompt_version_id', 'snippet_id'],
        rows: [[changeId, 'draft', name === 'Two' ? 'two' : 'one']],
        expectedChanges: 1,
      },
    ],
    before: {
      name: 'Original',
      content: 'Original content',
      references: ['original'],
    },
    after: { name, content: name, revision: next },
    versionId: 'draft',
    result: { revision: next, changeId, name },
    sideEffects: [
      { kind: 'notify_editors', payload: { documentId: 'prompt' } },
      { kind: 'invalidate_cache', payload: { documentId: 'prompt' } },
    ],
  }),
  ...options,
});

const revisionOf = async (db: D1Database, id = 'prompt') => {
  const revision = await db
    .prepare('SELECT revision FROM prompt WHERE id = ?')
    .bind(id)
    .first<string>('revision');
  if (!revision) throw new Error('Missing test revision');
  return revision;
};

const stateOf = async (db: D1Database) => {
  const results = await db.batch([
    db.prepare('SELECT id, name, revision FROM prompt ORDER BY id'),
    db.prepare('SELECT id, system_message FROM prompt_version ORDER BY id'),
    db.prepare(
      'SELECT id, prompt_version_id, snippet_id FROM prompt_version_snippet ORDER BY id',
    ),
    ...[
      'authoring_request',
      'authoring_change',
      'authoring_snapshot',
      'authoring_outbox',
    ].map((table) => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`)),
  ]);
  return results.map((result) => result.results);
};

test('authoring migration preserves definitions, initializes opaque revisions, and prevents concurrent duplicate drafts', async () => {
  await withDatabase(async (db) => {
    await migration(db, '0027_authoring_persistence.sql');
    expect(await revisionOf(db)).toMatch(/^[a-f0-9]{32}$/);
    expect(await revisionOf(db, 'other-prompt')).not.toBe(await revisionOf(db));
    expect(
      await db
        .prepare("SELECT system_message FROM prompt_version WHERE id = 'draft'")
        .first('system_message'),
    ).toBe('Original content');
    await db
      .prepare(
        "INSERT INTO prompt (id, name, organization_id, created_by) VALUES ('legacy', 'Legacy', 'workspace', 'alice')",
      )
      .run();
    expect(await revisionOf(db, 'legacy')).toMatch(/^[a-f0-9]{32}$/);
    for (const kind of ['prompt', 'composer']) {
      await db
        .prepare(
          `UPDATE ${kind}_version SET published_at = 1 WHERE ${kind}_id = ?`,
        )
        .bind(kind)
        .run();
      const attempts = await Promise.allSettled(
        ['first', 'second'].map((id) =>
          db
            .prepare(
              `INSERT INTO ${kind}_version (id, ${kind}_id, created_by) VALUES (?, ?, 'alice')`,
            )
            .bind(`${kind}-${id}`, kind)
            .run(),
        ),
      );
      expect(
        attempts.filter((attempt) => attempt.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((attempt) => attempt.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM ${kind}_version WHERE ${kind}_id = ? AND published_at IS NULL`,
          )
          .bind(kind)
          .first('count'),
      ).toBe(1);
    }
  }, false);
});

test('authoring CAS admits one writer and leaves no child, snapshot, request, or event from the loser', async () => {
  await withDatabase(async (db) => {
    const revision = await revisionOf(db);
    const results = await Promise.all([
      commitAuthoringMutation(db, edit(revision, 'one', 'One')),
      commitAuthoringMutation(db, edit(revision, 'two', 'Two')),
    ]);
    const winner = results.find((result) => result.status === 'committed');
    if (winner?.status !== 'committed') throw new Error('No winner');
    expect(
      results.filter((result) => result.status === 'not_admitted'),
    ).toHaveLength(1);
    const state = await stateOf(db);
    expect(state[0]).toContainEqual({
      id: 'prompt',
      name: winner.result.name,
      revision: winner.result.revision,
    });
    expect(state[1]).toContainEqual({
      id: 'draft',
      system_message: winner.result.name,
    });
    expect(state[2]).toEqual([
      {
        id: winner.result.changeId,
        prompt_version_id: 'draft',
        snippet_id: winner.result.name.toLowerCase(),
      },
    ]);
    expect(state.slice(3)).toEqual([
      [{ count: 1 }],
      [{ count: 1 }],
      [{ count: 2 }],
      [{ count: 2 }],
    ]);
    expect(
      await db
        .prepare('SELECT commit_state FROM authoring_request')
        .first('commit_state'),
    ).toBe('complete');
  });
});

test('authoring migration refuses duplicate drafts without deleting or altering existing definitions', async () => {
  await withDatabase(async (db) => {
    await db.batch([
      db.prepare(
        "INSERT INTO prompt_version (id, prompt_id, system_message, created_by) VALUES ('duplicate', 'prompt', 'Keep this draft', 'alice')",
      ),
      db.prepare(
        "INSERT INTO composer_version (id, composer_id, content, created_by) VALUES ('composer-duplicate', 'composer', '<p>Keep this too</p>', 'alice')",
      ),
    ]);
    await expect(
      migration(db, '0027_authoring_persistence.sql'),
    ).rejects.toThrow();
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt_version WHERE prompt_id = 'prompt'",
        )
        .first('count'),
    ).toBe(2);
    expect(
      await db
        .prepare(
          "SELECT system_message FROM prompt_version WHERE id = 'duplicate'",
        )
        .first('system_message'),
    ).toBe('Keep this draft');
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM composer_version WHERE composer_id = 'composer'",
        )
        .first('count'),
    ).toBe(2);
    expect(
      (
        await db.prepare('PRAGMA table_info(prompt)').all<{ name: string }>()
      ).results.some((column) => column.name === 'revision'),
    ).toBe(false);
  }, false);
});

test('authoring concurrent creation saves exactly one full prompt or composer with an opaque revision', async () => {
  await withDatabase(async (db) => {
    for (const kind of ['prompt', 'composer'] as const) {
      const documentId = `new-${kind}`;
      const input: AuthoringCommitInput<SavedResult> = {
        actor,
        operation: `create_${kind}`,
        requestKey: `${kind}-create`,
        requestHash: hash({ kind, name: 'Created' }),
        target: { kind, documentId, expectedRevision: null },
        guards: [],
        prepare: ({ revision, changeId }) => ({
          ensureDefaultFolder: true,
          writes: [
            {
              kind: 'insert',
              table: kind,
              columns: ['id', 'name', 'organization_id', 'created_by'],
              rows: [[documentId, `Created ${kind}`, 'workspace', 'alice']],
              expectedChanges: 1,
            },
            {
              kind: 'insert',
              table: kind === 'prompt' ? 'prompt_version' : 'composer_version',
              columns: [
                'id',
                `${kind}_id`,
                'created_by',
                kind === 'prompt' ? 'system_message' : 'content',
              ],
              rows: [[changeId, documentId, 'alice', 'Created content']],
              expectedChanges: 1,
            },
          ],
          before: null,
          after: {
            name: `Created ${kind}`,
            revision,
            content: 'Created content',
          },
          versionId: changeId,
          result: { revision, changeId, name: `Created ${kind}` },
          sideEffects: [{ kind: 'notify_editors', payload: { documentId } }],
        }),
      };
      const denied = await commitAuthoringMutation(db, {
        ...input,
        guards: [{ sql: '0' }],
      });
      expect(denied).toEqual({ status: 'not_admitted', currentRevision: null });
      expect(
        await db
          .prepare(`SELECT COUNT(*) AS count FROM ${kind}_folder`)
          .first('count'),
      ).toBe(0);
      await expect(
        commitAuthoringMutation(db, {
          ...input,
          prepare: (context) => {
            const plan = input.prepare(context);
            return {
              ...plan,
              writes: [
                ...plan.writes,
                {
                  kind: 'update',
                  table: kind,
                  set: { name: 'Missing root' },
                  where: { sql: 'id = ?', values: ['missing'] },
                  expectedChanges: 1,
                },
              ],
            };
          },
        }),
      ).rejects.toThrow();
      expect(
        await db
          .prepare(`SELECT COUNT(*) AS count FROM ${kind}_folder`)
          .first('count'),
      ).toBe(0);
      const results = await Promise.all([
        commitAuthoringMutation(db, input),
        commitAuthoringMutation(db, {
          ...input,
          requestKey: `${kind}-racing-create`,
        }),
      ]);
      const winner = results.find((result) => result.status === 'committed');
      if (winner?.status !== 'committed') throw new Error('Create failed');
      expect(
        results.filter((result) => result.status === 'not_admitted'),
      ).toHaveLength(1);
      expect(
        await db
          .prepare(`SELECT revision FROM ${kind} WHERE id = ?`)
          .bind(documentId)
          .first('revision'),
      ).toBe(winner.result.revision);
      expect(
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM ${kind}_version WHERE ${kind}_id = ?`,
          )
          .bind(documentId)
          .first('count'),
      ).toBe(1);
      expect(
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM ${kind}_folder WHERE name = 'Untitled' AND organization_id = 'workspace'`,
          )
          .first('count'),
      ).toBe(1);
      expect(
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM ${kind} p JOIN ${kind}_folder f ON p.folder_id = f.id WHERE p.id = ? AND f.name = 'Untitled'`,
          )
          .bind(documentId)
          .first('count'),
      ).toBe(1);
    }
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_request')
        .first('count'),
    ).toBe(2);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_snapshot')
        .first('count'),
    ).toBe(2);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_outbox')
        .first('count'),
    ).toBe(2);
  });
});

test('authoring permits an authorized browser soft delete while advancing revision and preserving history', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'browser-delete', 'Deleted', {
      actor: {
        source: 'browser',
        organizationId: 'workspace',
        userId: 'alice',
        name: 'Alice',
      },
      operation: 'delete_prompt',
    });
    const result = await commitAuthoringMutation(db, {
      ...input,
      prepare: (context) => ({
        ...input.prepare(context),
        writes: [
          {
            kind: 'update',
            table: 'prompt',
            set: { deleted_at: context.now },
            where: { sql: 'id = ?', values: ['prompt'] },
            expectedChanges: 1,
          },
        ],
      }),
    });
    expect(result.status).toBe('committed');
    expect(
      await db
        .prepare("SELECT deleted_at FROM prompt WHERE id = 'prompt'")
        .first('deleted_at'),
    ).toBeGreaterThan(0);
    expect(await revisionOf(db)).not.toBe(input.target.expectedRevision);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(1);
    expect(
      await commitAuthoringMutation(
        db,
        edit(await revisionOf(db), 'cannot-edit-deleted', 'One'),
      ),
    ).toEqual({ status: 'not_admitted', currentRevision: null });
  });
});

test('authoring replays original results before stale checks and rejects a conflicting key without preparing a write', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'same-key', 'One');
    const first = await commitAuthoringMutation(db, input);
    if (first.status !== 'committed') throw new Error('Initial write failed');
    const baseline = await stateOf(db);
    const replay = await commitAuthoringMutation(db, {
      ...input,
      prepare: () => {
        throw new Error('Replay prepared a write');
      },
    });
    expect(replay).toEqual({ status: 'replayed', result: first.result });
    expect(await readAuthoringReplay(db, input)).toEqual(replay);
    expect(
      await commitAuthoringMutation(db, {
        ...input,
        requestHash: hash('different input'),
        prepare: () => {
          throw new Error('Conflicting key prepared a write');
        },
      }),
    ).toEqual({ status: 'key_conflict' });
    expect(await stateOf(db)).toEqual(baseline);
  });
});

test('authoring simultaneous same-key calls replay one outcome and simultaneous different inputs conflict', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'same-key', 'One');
    const results = await Promise.all(
      Array.from({ length: 6 }, () => commitAuthoringMutation(db, input)),
    );
    expect(
      results.filter((result) => result.status === 'committed'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'replayed'),
    ).toHaveLength(5);
    expect(
      new Set(
        results.map((result) =>
          'result' in result ? result.result.changeId : null,
        ),
      ).size,
    ).toBe(1);
    const revision = await revisionOf(db);
    const collisions = await Promise.all([
      commitAuthoringMutation(db, edit(revision, 'collision', 'One')),
      commitAuthoringMutation(db, edit(revision, 'collision', 'Two')),
    ]);
    expect(
      collisions.filter((result) => result.status === 'committed'),
    ).toHaveLength(1);
    expect(
      collisions.filter((result) => result.status === 'key_conflict'),
    ).toHaveLength(1);
    expect((await stateOf(db)).slice(3)).toEqual([
      [{ count: 2 }],
      [{ count: 2 }],
      [{ count: 4 }],
      [{ count: 4 }],
    ]);
  });
});

test('authoring rolls back all earlier writes on a foreign-key failure, wrong affected-row count, or cross-document descriptor', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'rollback', 'One');
    const baseline = await stateOf(db);
    const failures: AuthoringWrite[] = [
      {
        kind: 'insert',
        table: 'prompt_version_snippet',
        columns: ['id', 'prompt_version_id', 'snippet_id'],
        rows: [['bad', 'draft', 'missing-snippet']],
        expectedChanges: 1,
      },
      {
        kind: 'update',
        table: 'prompt_version',
        set: { system_message: 'Missing' },
        where: { sql: 'id = ?', values: ['missing'] },
        expectedChanges: 1,
      },
      {
        kind: 'update',
        table: 'prompt_version',
        set: { system_message: 'Cross workspace' },
        where: { sql: 'id = ?', values: ['other-draft'] },
        expectedChanges: 1,
      },
      {
        kind: 'insert',
        table: 'prompt_version_snippet',
        columns: ['id', 'prompt_version_id', 'snippet_id'],
        rows: [['wrong-parent', 'other-draft', 'one']],
        expectedChanges: 1,
      },
    ];
    for (const failure of failures) {
      await expect(
        commitAuthoringMutation(db, {
          ...input,
          prepare: (context) => {
            const plan = input.prepare(context);
            return { ...plan, writes: [...plan.writes, failure] };
          },
        }),
      ).rejects.toThrow();
      expect(await stateOf(db)).toEqual(baseline);
    }
    expect((await commitAuthoringMutation(db, input)).status).toBe('committed');
  });
});

test('authoring commit guards prevent all writes when authorization changes after preparation', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'no-membership', 'One', {
      guards: [
        {
          sql: 'EXISTS (SELECT 1 FROM member WHERE id = ?)',
          values: ['removed'],
        },
      ],
    });
    const baseline = await stateOf(db);
    expect(await commitAuthoringMutation(db, input)).toEqual({
      status: 'not_admitted',
      currentRevision: input.target.expectedRevision,
    });
    expect(await stateOf(db)).toEqual(baseline);
    expect(
      await commitAuthoringMutation(db, {
        ...input,
        target: { ...input.target, documentId: 'other-prompt' },
        guards: [],
      }),
    ).toEqual({ status: 'not_admitted', currentRevision: null });
    expect(await stateOf(db)).toEqual(baseline);
  });
});

test('authoring keys are independently scoped to workspace, operation, MCP connection, and browser actor', async () => {
  await withDatabase(async (db) => {
    const original = edit(await revisionOf(db), 'scoped-key', 'One');
    expect((await commitAuthoringMutation(db, original)).status).toBe(
      'committed',
    );
    for (const changed of [
      { actor: { ...actor, organizationId: 'other' } },
      { operation: 'restore_prompt' },
      { actor: { ...actor, connectionId: 'second' } },
      {
        actor: {
          source: 'browser' as const,
          organizationId: 'workspace',
          userId: 'alice',
          name: 'Alice',
        },
      },
    ])
      expect(
        await readAuthoringReplay(db, { ...original, ...changed }),
      ).toEqual({ status: 'missing' });
    expect(
      (
        await commitAuthoringMutation(
          db,
          edit(await revisionOf(db), 'scoped-key', 'Two', {
            actor: { ...actor, connectionId: 'second' },
          }),
        )
      ).status,
    ).toBe('committed');
    expect(
      (
        await commitAuthoringMutation(
          db,
          edit(await revisionOf(db), 'scoped-key', 'One', {
            actor: {
              source: 'browser',
              organizationId: 'workspace',
              userId: 'alice',
              name: 'Alice',
            },
          }),
        )
      ).status,
    ).toBe('committed');
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_request')
        .first('count'),
    ).toBe(3);
  });
});

test('authoring retains history independently of retry keys and cleans up only bounded expired rows', async () => {
  await withDatabase(async (db) => {
    const now = 1_900_000_000_000;
    const input = edit(await revisionOf(db), 'expiring', 'One');
    expect((await commitAuthoringMutation(db, input, now)).status).toBe(
      'committed',
    );
    expect(
      (
        await readAuthoringReplay(
          db,
          input,
          now + AUTHORING_RETRY_WINDOW_MS - 1,
        )
      ).status,
    ).toBe('replayed');
    expect(
      await readAuthoringReplay(db, input, now + AUTHORING_RETRY_WINDOW_MS),
    ).toEqual({ status: 'missing' });
    expect(
      (
        await commitAuthoringMutation(
          db,
          edit(await revisionOf(db), 'expiring', 'Two'),
          now + AUTHORING_RETRY_WINDOW_MS,
        )
      ).status,
    ).toBe('committed');
    expect((await stateOf(db)).slice(3)).toEqual([
      [{ count: 1 }],
      [{ count: 2 }],
      [{ count: 4 }],
      [{ count: 4 }],
    ]);
    const cleaned = await cleanupAuthoringPersistence(
      db,
      now + AUTHORING_HISTORY_WINDOW_MS,
      1,
    );
    expect(cleaned).toEqual({ requests: 1, changes: 1, deliveredEvents: 0 });
    expect((await stateOf(db)).slice(3)).toEqual([
      [{ count: 0 }],
      [{ count: 1 }],
      [{ count: 2 }],
      [{ count: 4 }],
    ]);
    await db
      .prepare('UPDATE authoring_outbox SET delivered_at = ?')
      .bind(now)
      .run();
    expect(
      (
        await cleanupAuthoringPersistence(
          db,
          now + AUTHORING_HISTORY_WINDOW_MS,
          1,
        )
      ).deliveredEvents,
    ).toBe(1);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_outbox')
        .first('count'),
    ).toBe(3);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM prompt_version')
        .first('count'),
    ).toBe(2);
  });
});

test('authoring keeps history after connection deletion and cascades document/workspace auxiliary cleanup', async () => {
  await withDatabase(async (db) => {
    expect(
      (
        await commitAuthoringMutation(
          db,
          edit(await revisionOf(db), 'lifecycle', 'One'),
        )
      ).status,
    ).toBe('committed');
    await db
      .prepare("DELETE FROM mcp_connection WHERE id = 'connection'")
      .run();
    expect(
      await db
        .prepare('SELECT connection_id FROM authoring_change')
        .first('connection_id'),
    ).toBeNull();
    expect(
      await db
        .prepare('SELECT actor_scope FROM authoring_change')
        .first('actor_scope'),
    ).toBe('mcp:connection');
    await db.prepare("DELETE FROM prompt WHERE id = 'prompt'").run();
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_snapshot')
        .first('count'),
    ).toBe(0);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_change')
        .first('count'),
    ).toBe(0);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_outbox')
        .first('count'),
    ).toBe(2);
    await db.prepare("DELETE FROM organization WHERE id = 'workspace'").run();
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_request')
        .first('count'),
    ).toBe(0);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM authoring_outbox')
        .first('count'),
    ).toBe(0);
  });
});

test('authoring bulk reference inserts use bounded JSON instead of exceeding D1 bound parameters', async () => {
  await withDatabase(async (db) => {
    const input = edit(await revisionOf(db), 'bulk-refs', 'One');
    await db.batch(
      Array.from({ length: 100 }, (_, index) =>
        db
          .prepare(
            "INSERT INTO snippet (id, name, organization_id, created_by) VALUES (?, ?, 'workspace', 'alice')",
          )
          .bind(`bulk-${index}`, `Bulk ${index}`),
      ),
    );
    const result = await commitAuthoringMutation(db, {
      ...input,
      prepare: (context) => {
        const plan = input.prepare(context);
        return {
          ...plan,
          writes: [
            ...plan.writes.slice(0, 3),
            {
              kind: 'insert',
              table: 'prompt_version_snippet',
              columns: ['id', 'prompt_version_id', 'snippet_id'],
              rows: Array.from({ length: 100 }, (_, index) => [
                `ref-${index}`,
                'draft',
                `bulk-${index}`,
              ]),
              expectedChanges: 100,
            },
          ],
        };
      },
    });
    expect(result.status).toBe('committed');
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM prompt_version_snippet')
        .first('count'),
    ).toBe(100);
    const baseline = await stateOf(db);
    await expect(
      commitAuthoringMutation(db, {
        ...edit(await revisionOf(db), 'too-big', 'Two'),
        prepare: (context) => ({
          ...input.prepare(context),
          after: { content: '漢'.repeat(270_000) },
        }),
      }),
    ).rejects.toThrow('786432-byte');
    expect(await stateOf(db)).toEqual(baseline);
  });
});
