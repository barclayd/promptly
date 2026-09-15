import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import {
  authorizeMcpConnection,
  claimMcpGrant,
  createMcpConnection,
} from '../../app/lib/mcp/connections.server';
import {
  isMcpRevocationRequest,
  withMcpRevocationKv,
} from '../../app/lib/mcp/revocation.server';
import { expect, test } from '../fixtures/base';

const withStorage = async (
  run: (db: D1Database, kv: KVNamespace) => Promise<void>,
) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default { fetch: () => new Response("MCP revocation test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
      kvNamespaces: ['KV'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    const { KV: kv } = await runtime.getBindings<{ KV: KVNamespace }>();
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
      '0024_mcp_connections.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      await db.batch(
        sql
          .replaceAll('--> statement-breakpoint', '')
          .split(';')
          .map((statement) => statement.trim())
          .filter(Boolean)
          .map((statement) => db.prepare(statement)),
      );
    }
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.com')",
      ),
      db.prepare(
        "INSERT INTO organization (id, name, slug, created_at) VALUES ('workspace', 'Workspace', 'workspace', 1)",
      ),
      db.prepare(
        "INSERT INTO member (id, user_id, organization_id, role, created_at) VALUES ('membership', 'alice', 'workspace', 'owner', 1)",
      ),
    ]);
    await run(db, kv);
  } finally {
    await runtime.dispose();
  }
};

const connect = async (db: D1Database) => {
  const connection = await createMcpConnection(db, {
    userId: 'alice',
    clientId: 'client',
    clientName: 'Test client',
  });
  await claimMcpGrant(db, {
    connectionId: connection.id,
    userId: connection.userId,
    grantId: connection.id,
  });
  return {
    connectionId: connection.id,
    userId: connection.userId,
    clientId: connection.clientId,
    tokenScopes: connection.scopes,
  };
};

test('MCP revocation storage adapter applies only to provider-supported revocation requests', async () => {
  const request = (body: Record<string, string>, path = '/oauth/token') =>
    new Request(`https://promptly.example${path}`, {
      method: 'POST',
      body: new URLSearchParams(body),
    });
  expect(await isMcpRevocationRequest(request({ token: 'candidate' }))).toBe(
    true,
  );
  expect(
    await isMcpRevocationRequest(
      request({ token: 'candidate', grant_type: '' }),
    ),
  ).toBe(true);
  expect(
    await isMcpRevocationRequest(
      request({ grant_type: 'refresh_token', token: 'candidate' }),
    ),
  ).toBe(false);
  expect(await isMcpRevocationRequest(request({ client_id: 'client' }))).toBe(
    false,
  );
  expect(
    await isMcpRevocationRequest(request({ token: 'candidate' }, '/mcp')),
  ).toBe(false);
  expect(
    await isMcpRevocationRequest(
      new Request('https://promptly.example/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'candidate' }),
      }),
    ),
  ).toBe(false);
});

test('MCP revocation marks D1 before deleting KV and recreated tokens cannot restore access', async () => {
  await withStorage(async (db, kv) => {
    const connection = await connect(db);
    const other = await connect(db);
    const tokenKey = `token:alice:${connection.connectionId}:tokenhash`;
    await kv.put(tokenKey, 'original token record');
    const observedKv = new Proxy(kv, {
      get: (target, property) => {
        if (property === 'delete') {
          return async (key: string) => {
            const state = await db
              .prepare('SELECT revoked_at FROM mcp_connection WHERE id = ?')
              .bind(connection.connectionId)
              .first<{ revoked_at: number | null }>();
            expect(state?.revoked_at).toBeGreaterThan(0);
            await target.delete(key);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const wrapped = withMcpRevocationKv(db, observedKv);
    await wrapped.delete(tokenKey);
    await expect(authorizeMcpConnection(db, connection)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    await kv.put(tokenKey, 'record recreated by concurrent refresh');
    expect(await kv.get(tokenKey)).toBe(
      'record recreated by concurrent refresh',
    );
    await expect(authorizeMcpConnection(db, connection)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    expect(
      (await authorizeMcpConnection(db, other)).connection.revokedAt,
    ).toBeNull();
  });
});

test('MCP grant revocation with no access-token keys still revokes the connection', async () => {
  await withStorage(async (db, kv) => {
    const connection = await connect(db);
    const key = `grant:alice:${connection.connectionId}`;
    await kv.put(key, 'refresh grant');
    await withMcpRevocationKv(db, kv).delete(key);
    expect(await kv.get(key)).toBeNull();
    await expect(authorizeMcpConnection(db, connection)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
  });
});

test('MCP revocation refuses to delete KV when D1 revocation fails', async () => {
  await withStorage(async (db, kv) => {
    const key = 'grant:alice:grant';
    await kv.put(key, 'grant record');
    await db.prepare('DROP TABLE mcp_connection').run();
    await expect(withMcpRevocationKv(db, kv).delete(key)).rejects.toThrow();
    expect(await kv.get(key)).toBe('grant record');
  });
});

test('MCP revocation fails closed on unrecognized provider storage keys', async () => {
  await withStorage(async (db, kv) => {
    const wrapped = withMcpRevocationKv(db, kv);
    await wrapped.put('client:registered', 'client metadata');
    expect(await wrapped.get('client:registered')).toBe('client metadata');
    await expect(wrapped.delete('client:registered')).rejects.toThrow(
      'Unexpected OAuth revocation storage key.',
    );
    expect(await kv.get('client:registered')).toBe('client metadata');
  });
});
