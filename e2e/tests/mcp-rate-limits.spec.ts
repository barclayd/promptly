import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import {
  checkMcpRateLimit,
  checkMcpRegistrationRateLimit,
  MCP_REGISTRATION_GLOBAL_LIMIT,
  MCP_REGISTRATION_SOURCE_LIMIT,
} from '../../app/lib/mcp/usage.server';
import { expect, test } from '../fixtures/base';

const withDatabase = async (run: (db: D1Database) => Promise<void>) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch: () => new Response("MCP rate test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    const sql = await readFile(
      new URL(
        '../../migrations/drizzle/0025_mcp_authorization_requests.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await db.batch(
      sql
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => db.prepare(statement)),
    );
    await run(db);
  } finally {
    await runtime.dispose();
  }
};

test('MCP registration limits concurrent requests per source and resets at the next minute', async () => {
  await withDatabase(async (db) => {
    const start = 1_800_000;
    const results = await Promise.all(
      Array.from({ length: MCP_REGISTRATION_SOURCE_LIMIT + 4 }, () =>
        checkMcpRegistrationRateLimit(db, '192.0.2.1', start + 1_000),
      ),
    );
    expect(results.filter((result) => result === null)).toHaveLength(
      MCP_REGISTRATION_SOURCE_LIMIT,
    );
    expect(results.filter((result) => result !== null)).toEqual([
      59, 59, 59, 59,
    ]);
    expect(
      await checkMcpRegistrationRateLimit(db, '192.0.2.1', start + 59_001),
    ).toBe(1);
    expect(
      await checkMcpRegistrationRateLimit(db, '192.0.2.1', start + 60_000),
    ).toBeNull();
    const { results: keys } = await db
      .prepare('SELECT key FROM mcp_rate_limit')
      .all<{ key: string }>();
    expect(keys).toHaveLength(2);
    expect(keys.some((row) => row.key.includes('192.0.2.1'))).toBe(false);
    expect(
      keys.find((row) => row.key.startsWith('registration:source:'))?.key,
    ).toMatch(/^registration:source:[a-f0-9]{64}$/);
  });
});

test('MCP source throttling leaves capacity for other sources', async () => {
  await withDatabase(async (db) => {
    const now = 1_800_000;
    for (let count = 0; count < MCP_REGISTRATION_SOURCE_LIMIT; count++) {
      expect(
        await checkMcpRegistrationRateLimit(db, '192.0.2.1', now),
      ).toBeNull();
    }
    for (let count = 0; count < MCP_REGISTRATION_GLOBAL_LIMIT; count++) {
      expect(await checkMcpRegistrationRateLimit(db, '192.0.2.1', now)).toBe(
        60,
      );
    }
    expect(
      await checkMcpRegistrationRateLimit(db, '192.0.2.2', now),
    ).toBeNull();
    const row = await db
      .prepare(
        "SELECT request_count FROM mcp_rate_limit WHERE key = 'registration:global'",
      )
      .first<{ request_count: number }>();
    expect(row?.request_count).toBe(MCP_REGISTRATION_SOURCE_LIMIT + 1);
  });
});

test('MCP global registration limits also bound source-key growth', async () => {
  await withDatabase(async (db) => {
    const start = 1_800_000;
    const results = await Promise.all(
      Array.from({ length: MCP_REGISTRATION_GLOBAL_LIMIT + 12 }, (_, index) =>
        checkMcpRegistrationRateLimit(db, `192.0.2.${index}`, start),
      ),
    );
    expect(results.filter((result) => result === null)).toHaveLength(
      MCP_REGISTRATION_GLOBAL_LIMIT,
    );
    expect(results.filter((result) => result !== null)).toHaveLength(12);
    const row = await db
      .prepare('SELECT COUNT(*) AS count FROM mcp_rate_limit')
      .first<{ count: number }>();
    expect(row?.count).toBe(MCP_REGISTRATION_GLOBAL_LIMIT + 1);
    expect(
      await checkMcpRegistrationRateLimit(db, '198.51.100.1', start + 60_000),
    ).toBeNull();
  });
});

test('MCP registration cleans old rate keys in bounded batches without changing tool limits', async () => {
  await withDatabase(async (db) => {
    const now = 1_800_000;
    await db.batch(
      Array.from({ length: 205 }, (_, index) =>
        db
          .prepare('INSERT INTO mcp_rate_limit VALUES (?, ?, ?)')
          .bind(`old:${index}`, now - 10 * 60_000, 1),
      ),
    );
    const oldCount = async () =>
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS count FROM mcp_rate_limit WHERE key LIKE 'old:%'",
          )
          .first<{ count: number }>()
      )?.count;
    await checkMcpRateLimit(db, 'connection', 'workspace');
    await checkMcpRegistrationRateLimit(db, '192.0.2.1', now);
    expect(await oldCount()).toBe(105);
    await checkMcpRegistrationRateLimit(db, '192.0.2.1', now);
    expect(await oldCount()).toBe(5);
    await checkMcpRegistrationRateLimit(db, '192.0.2.1', now);
    expect(await oldCount()).toBe(0);
    const { results } = await db
      .prepare(
        'SELECT key, request_count FROM mcp_rate_limit WHERE key IN (?, ?)',
      )
      .bind('connection:connection', 'workspace:workspace')
      .all<{ key: string; request_count: number }>();
    expect(results).toHaveLength(2);
    expect(results.every((row) => row.request_count === 1)).toBe(true);
  });
});
