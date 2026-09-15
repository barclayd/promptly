import { readFile } from 'node:fs/promises';
import {
  deliverAuthoringEvents,
  type SavedRevisionNotification,
} from '../../app/lib/authoring/outbox.server';
import { withAuthoringDatabase } from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

const withOutbox = (run: (db: D1Database) => Promise<void>) =>
  withAuthoringDatabase(async (db) => {
    for (const name of [
      '0024_mcp_connections.sql',
      '0027_authoring_persistence.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      await db.batch(
        sql
          .split('--> statement-breakpoint')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => db.prepare(part)),
      );
    }
    await run(db);
  });

const addEvent = (
  db: D1Database,
  id: string,
  kind: 'invalidate_cache' | 'notify_editors',
  payload: unknown = {},
) =>
  db
    .prepare(`INSERT INTO authoring_outbox
  (id,organization_id,change_id,document_kind,document_id,revision,event_kind,payload_json,created_at,available_at)
  VALUES (?,'workspace',?,'prompt','prompt','revision',?,?,1,1)`)
    .bind(id, `change-${id}`, kind, JSON.stringify(payload))
    .run();

const environment = (
  db: D1Database,
  options: { fail?: boolean; keys?: Set<string> } = {},
) => {
  const deleted: string[] = [];
  const notifications: SavedRevisionNotification[] = [];
  const keys = options.keys ?? new Set<string>();
  const env = {
    promptly: db,
    PROMPTS_CACHE: {
      delete: async (name: string) => {
        if (options.fail) throw new Error('simulated KV failure');
        deleted.push(name);
        keys.delete(name);
      },
      list: async ({ prefix, limit }: { prefix: string; limit: number }) => {
        const matches = [...keys].filter((key) => key.startsWith(prefix));
        return {
          keys: matches.slice(0, limit).map((name) => ({ name })),
          list_complete: matches.length <= limit,
        };
      },
    },
    PRESENCE_ROOM: {
      getByName: (name: string) => ({
        savedRevision: async (notification: SavedRevisionNotification) => {
          expect(name).toBe(notification.documentId);
          notifications.push(notification);
        },
      }),
    },
  } as unknown as Pick<Env, 'promptly' | 'PROMPTS_CACHE' | 'PRESENCE_ROOM'>;
  return { env, deleted, notifications };
};

test('outbox workers claim each event once and notify only saved revision metadata', async () => {
  await withOutbox(async (db) => {
    await addEvent(db, 'cache', 'invalidate_cache', {
      publishedVersion: '1.0.0',
    });
    await addEvent(db, 'notice', 'notify_editors');
    const { env, deleted, notifications } = environment(db);
    const results = await Promise.all([
      deliverAuthoringEvents(env, { now: 100 }),
      deliverAuthoringEvents(env, { now: 100 }),
    ]);
    expect(results.reduce((count, result) => count + result.delivered, 0)).toBe(
      2,
    );
    expect(deleted.sort()).toEqual([
      'prompt:prompt',
      'version:prompt:1.0.0',
      'version:prompt:latest',
    ]);
    expect(notifications).toEqual([
      {
        type: 'saved_revision',
        documentId: 'prompt',
        kind: 'prompt',
        revision: 'revision',
        changeId: 'change-notice',
      },
    ]);
    expect(await deliverAuthoringEvents(env, { now: 101 })).toEqual({
      delivered: 0,
      deferred: 0,
      failed: 0,
    });
  });
});

test('failed delivery retains committed events, backs off, and recovers expired leases', async () => {
  await withOutbox(async (db) => {
    await addEvent(db, 'cache', 'invalidate_cache');
    const broken = environment(db, { fail: true });
    expect(await deliverAuthoringEvents(broken.env, { now: 100 })).toEqual({
      delivered: 0,
      deferred: 0,
      failed: 1,
    });
    const record = await db
      .prepare(
        "SELECT delivered_at,last_error_code,available_at FROM authoring_outbox WHERE id='cache'",
      )
      .first();
    expect(record).toEqual({
      delivered_at: null,
      last_error_code: 'delivery_failed',
      available_at: 2100,
    });
    const recovered = environment(db);
    expect(
      (await deliverAuthoringEvents(recovered.env, { now: 2099 })).delivered,
    ).toBe(0);
    await db
      .prepare(
        "UPDATE authoring_outbox SET lease_id='interrupted',lease_expires_at=3000 WHERE id='cache'",
      )
      .run();
    expect(
      (await deliverAuthoringEvents(recovered.env, { now: 2999 })).delivered,
    ).toBe(0);
    expect(
      (await deliverAuthoringEvents(recovered.env, { now: 3000 })).delivered,
    ).toBe(1);
  });
});

test('deletion invalidation continues across bounded pages without skipping version keys', async () => {
  await withOutbox(async (db) => {
    await addEvent(db, 'cache', 'invalidate_cache', { allVersions: true });
    const keys = new Set(
      Array.from({ length: 205 }, (_, index) => `version:prompt:1.0.${index}`),
    );
    keys.add('version:another:1.0.0');
    const { env } = environment(db, { keys });
    expect(await deliverAuthoringEvents(env, { now: 100 })).toEqual({
      delivered: 0,
      deferred: 1,
      failed: 0,
    });
    expect(await deliverAuthoringEvents(env, { now: 101 })).toEqual({
      delivered: 0,
      deferred: 1,
      failed: 0,
    });
    expect(await deliverAuthoringEvents(env, { now: 102 })).toEqual({
      delivered: 1,
      deferred: 0,
      failed: 0,
    });
    expect([...keys]).toEqual(['version:another:1.0.0']);
  });
});
