import type { AuthoringPrincipal } from '../../app/lib/authoring/access.server';
import { canonicalAuthoringRequestHash } from '../../app/lib/authoring/edits';
import {
  getAuthoringAfterSnapshot,
  getAuthoringChange,
  listAuthoringChanges,
} from '../../app/lib/authoring/history.server';
import {
  normalizeComposerDefinition,
  normalizePromptDefinition,
} from '../../app/lib/authoring/normalize';
import {
  AUTHORING_HISTORY_WINDOW_MS,
  AUTHORING_RETRY_WINDOW_MS,
  type AuthoringPreparedCommit,
  commitAuthoringMutation,
} from '../../app/lib/authoring/persistence.server';
import { readPromptDefinition } from '../../app/lib/authoring/reads.server';
import { AUTHORING_LIMITS } from '../../app/lib/validations/authoring';
import {
  applyAuthoringFixtureMigration,
  withAuthoringDatabase,
} from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

const now = 2_000_000_000_000;
const principal: AuthoringPrincipal = {
  source: 'browser',
  userId: 'alice',
  organizationId: 'workspace',
};
const mcpPrincipal: AuthoringPrincipal = {
  source: 'mcp',
  userId: 'alice',
  connectionId: 'connection',
  clientId: 'client',
  tokenScopes: ['mcp:read'],
};

const withHistoryDatabase = (run: (db: D1Database) => Promise<void>) =>
  withAuthoringDatabase(async (db) => {
    await applyAuthoringFixtureMigration(db, '0024_mcp_connections.sql');
    await applyAuthoringFixtureMigration(db, '0027_authoring_persistence.sql');
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email) VALUES ('bob', 'Bob', 'bob@example.com'), ('reader', 'Reader', 'reader@example.com')",
      ),
      db.prepare(
        "INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ('member', 'workspace', 'alice', 'member', 1), ('foreign-member', 'foreign', 'bob', 'owner', 1), ('reader-member', 'workspace', 'reader', 'member', 1)",
      ),
      db.prepare(
        "INSERT INTO mcp_connection (id, user_id, organization_id, membership_id, client_id, client_name, scopes, grant_id, created_at) VALUES ('connection', 'alice', 'workspace', 'member', 'client', 'Test Client', '[\"mcp:read\"]', 'grant', 1)",
      ),
    ]);
    await run(db);
  });

const recordPromptChange = async (
  db: D1Database,
  name: string,
  timestamp = now,
) => {
  const before = await readPromptDefinition(db, {
    organizationId: 'workspace',
    id: 'prompt',
    version: { kind: 'working' },
  });
  if (!before.metadata.revision) throw new Error('Expected migrated revision');
  const result = await commitAuthoringMutation(
    db,
    {
      actor: {
        source: 'browser',
        organizationId: 'workspace',
        userId: 'alice',
        name: 'Alice at save time',
      },
      operation: 'update_prompt',
      requestKey: name,
      requestHash: await canonicalAuthoringRequestHash({
        name,
        expectedRevision: before.metadata.revision,
      }),
      target: {
        kind: 'prompt',
        documentId: 'prompt',
        expectedRevision: before.metadata.revision,
      },
      guards: [{ sql: "EXISTS (SELECT 1 FROM member WHERE id = 'member')" }],
      prepare: ({
        revision,
        changeId,
      }): AuthoringPreparedCommit<{ revision: string; changeId: string }> => ({
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
            set: { system_message: name, updated_at: timestamp },
            where: { sql: 'id = ?', values: [before.version.id] },
            expectedChanges: 1,
          },
        ],
        before: {
          definition: before.definition,
          folderId: before.metadata.folderId,
          version: before.version,
        },
        after: {
          definition: { ...before.definition, name, systemMessage: name },
          folderId: before.metadata.folderId,
          version: { ...before.version, updatedAt: timestamp },
        },
        versionId: before.version.id,
        result: { revision, changeId },
        sideEffects: [],
      }),
    },
    timestamp,
  );
  if (result.status !== 'committed')
    throw new Error('Expected history fixture commit');
  return result.result;
};

test('history returns the immutable committed after-state after another writer changes the same draft', async () => {
  await withHistoryDatabase(async (db) => {
    const first = await recordPromptChange(db, 'First saved state');
    const second = await recordPromptChange(db, 'Newer saved state', now + 1);
    const historical = await getAuthoringAfterSnapshot(
      db,
      principal,
      {
        kind: 'prompt',
        id: 'prompt',
        changeId: first.changeId,
        revision: first.revision,
      },
      now + 2,
    );
    expect(historical.kind).toBe('prompt');
    expect(historical.definition).toMatchObject({
      name: 'First saved state',
      systemMessage: 'First saved state',
    });
    expect(historical.revision).toBe(first.revision);
    expect(
      await getAuthoringAfterSnapshot(
        db,
        principal,
        { kind: 'prompt', id: 'prompt', revision: first.revision },
        now + 2,
      ),
    ).toEqual(historical);
    const source = await readPromptDefinition(db, {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'working' },
    });
    expect(source.definition.name).toBe('Newer saved state');
    expect(source.metadata.revision).toBe(second.revision);
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        {
          kind: 'prompt',
          id: 'prompt',
          changeId: first.changeId,
          revision: second.revision,
        },
        now + 2,
      ),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    const full = await getAuthoringChange(
      db,
      principal,
      { changeId: first.changeId },
      now + 2,
    );
    expect(full.before?.definition.name).toBe('Current prompt name');
    expect(full.after.definition.name).toBe('First saved state');
    expect(full.change.actor.name).toBe('Alice at save time');
  });
});

test('history has independent 90-day retention after idempotency records expire', async () => {
  await withHistoryDatabase(async (db) => {
    const saved = await recordPromptChange(db, 'Retained state');
    await db
      .prepare('DELETE FROM authoring_request WHERE expires_at <= ?')
      .bind(now + AUTHORING_RETRY_WINDOW_MS)
      .run();
    const input = {
      kind: 'prompt' as const,
      id: 'prompt',
      changeId: saved.changeId,
    };
    expect(
      (
        await getAuthoringAfterSnapshot(
          db,
          principal,
          input,
          now + AUTHORING_RETRY_WINDOW_MS + 1,
        )
      ).definition.name,
    ).toBe('Retained state');
    expect(
      (
        await getAuthoringAfterSnapshot(
          db,
          principal,
          input,
          now + AUTHORING_HISTORY_WINDOW_MS - 1,
        )
      ).definition.name,
    ).toBe('Retained state');
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        input,
        now + AUTHORING_HISTORY_WINDOW_MS,
      ),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    expect(
      await listAuthoringChanges(
        db,
        principal,
        {},
        now + AUTHORING_HISTORY_WINDOW_MS,
      ),
    ).toEqual({ items: [], nextOffset: null });
    await db
      .prepare('UPDATE authoring_change SET expires_at = ? WHERE id = ?')
      .bind(now + AUTHORING_HISTORY_WINDOW_MS * 2, saved.changeId)
      .run();
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        input,
        now + AUTHORING_HISTORY_WINDOW_MS + 1,
      ),
    ).rejects.toMatchObject({ code: 'change_not_found' });
  });
});

test('history lists paginate metadata and allow workspace readers without exposing snapshot content', async () => {
  await withHistoryDatabase(async (db) => {
    const older = await recordPromptChange(db, 'Private body older');
    const newer = await recordPromptChange(db, 'Private body newer', now + 1);
    const reader: AuthoringPrincipal = {
      source: 'browser',
      userId: 'reader',
      organizationId: 'workspace',
    };
    const first = await listAuthoringChanges(
      db,
      reader,
      { kind: 'prompt', id: 'prompt', limit: 1 },
      now + 2,
    );
    expect(first.items.map((change) => change.id)).toEqual([newer.changeId]);
    expect(first.nextOffset).toBe(1);
    const second = await listAuthoringChanges(
      db,
      reader,
      { kind: 'prompt', id: 'prompt', limit: 1, offset: 1 },
      now + 2,
    );
    expect(second.items.map((change) => change.id)).toEqual([older.changeId]);
    expect(second.nextOffset).toBeNull();
    expect(JSON.stringify(first)).not.toContain('systemMessage');
    expect(JSON.stringify(first)).not.toContain('definition');
    expect(
      (
        await getAuthoringChange(
          db,
          reader,
          { changeId: older.changeId },
          now + 2,
        )
      ).after.definition.name,
    ).toBe('Private body older');
  });
});

test('history rechecks workspace membership and hides foreign or deleted documents', async () => {
  await withHistoryDatabase(async (db) => {
    const saved = await recordPromptChange(db, 'Protected history');
    const foreign: AuthoringPrincipal = {
      source: 'browser',
      userId: 'bob',
      organizationId: 'foreign',
    };
    await expect(
      getAuthoringChange(db, foreign, { changeId: saved.changeId }, now),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    expect((await listAuthoringChanges(db, foreign, {}, now)).items).toEqual(
      [],
    );
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        { kind: 'composer', id: 'composer', changeId: saved.changeId },
        now,
      ),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        { kind: 'prompt', id: 'empty-prompt', changeId: saved.changeId },
        now,
      ),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    await db.prepare("DELETE FROM member WHERE id = 'reader-member'").run();
    await expect(
      getAuthoringChange(
        db,
        { source: 'browser', userId: 'reader', organizationId: 'workspace' },
        { changeId: saved.changeId },
        now,
      ),
    ).rejects.toMatchObject({ code: 'access_denied' });
    await db
      .prepare("UPDATE prompt SET deleted_at = ? WHERE id = 'prompt'")
      .bind(now)
      .run();
    await expect(
      getAuthoringChange(db, principal, { changeId: saved.changeId }, now),
    ).rejects.toMatchObject({ code: 'change_not_found' });
    expect((await listAuthoringChanges(db, principal, {}, now)).items).toEqual(
      [],
    );
  });
});

test('MCP history requires effective read scope and stops immediately after revocation or member removal', async () => {
  await withHistoryDatabase(async (db) => {
    const saved = await recordPromptChange(db, 'MCP readable state');
    expect(
      (
        await getAuthoringChange(
          db,
          mcpPrincipal,
          { changeId: saved.changeId },
          now,
        )
      ).after.definition.name,
    ).toBe('MCP readable state');
    await expect(
      getAuthoringChange(
        db,
        { ...mcpPrincipal, source: 'mcp', tokenScopes: ['mcp:write'] },
        { changeId: saved.changeId },
        now,
      ),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
    await db
      .prepare(
        "UPDATE mcp_connection SET revoked_at = ? WHERE id = 'connection'",
      )
      .bind(now)
      .run();
    await expect(
      listAuthoringChanges(db, mcpPrincipal, {}, now),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
    await db
      .prepare(
        "UPDATE mcp_connection SET revoked_at = NULL WHERE id = 'connection'",
      )
      .run();
    await db.prepare("DELETE FROM member WHERE id = 'member'").run();
    await expect(
      getAuthoringChange(db, mcpPrincipal, { changeId: saved.changeId }, now),
    ).rejects.toMatchObject({ code: 'workspace_unavailable' });
  });
});

test('history validates the saved envelope and never substitutes current content for a missing snapshot', async () => {
  await withHistoryDatabase(async (db) => {
    const saved = await recordPromptChange(db, 'Original snapshot');
    await db
      .prepare(
        "UPDATE authoring_snapshot SET definition_json = ? WHERE change_id = ? AND phase = 'after'",
      )
      .bind(
        JSON.stringify({
          definition: { name: 'Wrong shape' },
          folderId: null,
          version: { id: 'wrong-version' },
        }),
        saved.changeId,
      )
      .run();
    await expect(
      getAuthoringAfterSnapshot(
        db,
        principal,
        { kind: 'prompt', id: 'prompt', changeId: saved.changeId },
        now,
      ),
    ).rejects.toMatchObject({ code: 'invalid_stored_definition' });
    await db
      .prepare(
        "DELETE FROM authoring_snapshot WHERE change_id = ? AND phase = 'after'",
      )
      .bind(saved.changeId)
      .run();
    await expect(
      getAuthoringChange(db, principal, { changeId: saved.changeId }, now),
    ).rejects.toMatchObject({ code: 'invalid_stored_definition' });
    expect(
      (await listAuthoringChanges(db, principal, {}, now)).items,
    ).toHaveLength(1);
  });
});

test('history preserves valid definitions at the depth and node limits without charging envelope metadata against them', async () => {
  await withHistoryDatabase(async (db) => {
    let nested: unknown = 'leaf';
    for (let index = 0; index < AUTHORING_LIMITS.jsonDepth - 2; index++)
      nested = { child: nested };
    const base = normalizePromptDefinition({
      name: 'Node boundary',
    }).definition;
    const countNodes = (value: unknown): number =>
      1 +
      (value !== null && typeof value === 'object'
        ? Object.values(value).reduce<number>(
            (total, child) => total + countNodes(child),
            0,
          )
        : 0);
    const nearNodeLimit = Array.from(
      { length: AUTHORING_LIMITS.jsonNodes - countNodes(base) - 1 },
      () => 0,
    );
    for (const [label, config] of [
      ['Depth boundary', { legacy: nested }],
      ['Node boundary', { ...base.config, legacy: nearNodeLimit }],
    ] as const) {
      await db
        .prepare(
          "UPDATE prompt_version SET config = ? WHERE id = 'prompt-draft'",
        )
        .bind(JSON.stringify(config))
        .run();
      const saved = await recordPromptChange(db, label);
      const historical = await getAuthoringAfterSnapshot(
        db,
        principal,
        { kind: 'prompt', id: 'prompt', changeId: saved.changeId },
        now,
      );
      expect(historical.definition.config.legacy).toEqual(config.legacy);
      expect(
        (
          await getAuthoringChange(
            db,
            principal,
            { changeId: saved.changeId },
            now,
          )
        ).before?.definition.config.legacy,
      ).toEqual(config.legacy);
    }
  });
});

test('composer creation history has no before-state and retains its exact saved definition', async () => {
  await withHistoryDatabase(async (db) => {
    const definition = normalizeComposerDefinition({
      name: 'Created composer',
      content: '<p>Created content</p>',
      config: { inputData: { value: 1 } },
    }).definition;
    const version = {
      id: 'created-composer-draft',
      status: 'draft' as const,
      version: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    const created = await commitAuthoringMutation(
      db,
      {
        actor: {
          source: 'mcp',
          organizationId: 'workspace',
          userId: 'alice',
          name: 'Alice',
          connectionId: 'connection',
          clientId: 'client',
          clientName: 'Test Client',
        },
        operation: 'create_composer',
        requestKey: 'create-composer',
        requestHash: await canonicalAuthoringRequestHash(definition),
        target: {
          kind: 'composer',
          documentId: 'created-composer',
          expectedRevision: null,
        },
        guards: [],
        prepare: ({ changeId, revision }) => ({
          writes: [
            {
              kind: 'insert',
              table: 'composer',
              columns: ['id', 'name', 'organization_id', 'created_by'],
              rows: [
                ['created-composer', definition.name, 'workspace', 'alice'],
              ],
              expectedChanges: 1,
            },
            {
              kind: 'insert',
              table: 'composer_version',
              columns: [
                'id',
                'composer_id',
                'content',
                'config',
                'created_by',
                'created_at',
                'updated_at',
              ],
              rows: [
                [
                  version.id,
                  'created-composer',
                  definition.content,
                  JSON.stringify(definition.config),
                  'alice',
                  now,
                  now,
                ],
              ],
              expectedChanges: 1,
            },
          ],
          before: null,
          after: { definition, folderId: null, version },
          versionId: version.id,
          result: { changeId, revision },
          sideEffects: [],
        }),
      },
      now,
    );
    if (created.status !== 'committed')
      throw new Error('Expected composer create');
    const history = await getAuthoringChange(
      db,
      principal,
      { changeId: created.result.changeId },
      now,
    );
    expect(history.before).toBeNull();
    expect(history.after).toEqual({
      kind: 'composer',
      definition,
      folderId: null,
      version,
    });
    expect(history.change.actor).toMatchObject({
      source: 'mcp',
      clientName: 'Test Client',
      clientId: 'client',
      name: 'Alice',
    });
    expect(
      (
        await listAuthoringChanges(db, principal, { kind: 'composer' }, now)
      ).items.map((change) => change.id),
    ).toEqual([created.result.changeId]);
  });
});
