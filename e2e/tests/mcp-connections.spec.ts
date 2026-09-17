import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import {
  attachMcpGrant,
  authorizeMcpConnection,
  claimMcpGrant,
  createMcpConnection,
  getMcpWorkspace,
  listMcpConnections,
  revokeMcpConnection,
} from '../../app/lib/mcp/connections.server';
import { mcpGrantScopesSchema } from '../../app/lib/validations/mcp';
import { expect, test } from '../fixtures/base';

const withDatabase = async (run: (db: D1Database) => Promise<void>) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default { fetch: () => new Response("MCP connection test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
      '0024_mcp_connections.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      const statements = sql
        .replaceAll('--> statement-breakpoint', '')
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);
      await db.batch(statements.map((statement) => db.prepare(statement)));
    }
    await db.batch([
      db.prepare(`INSERT INTO user (id, name, email) VALUES
        ('alice', 'Alice', 'alice@example.com'),
        ('bob', 'Bob', 'bob@example.com'),
        ('owner', 'Owner', 'owner@example.com'),
        ('outsider', 'Outsider', 'outsider@example.com')`),
      db.prepare(`INSERT INTO organization (id, name, slug, created_at) VALUES
        ('workspace', 'Workspace', 'workspace', 1),
        ('other-workspace', 'Other Workspace', 'other-workspace', 1)`),
      db.prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at) VALUES
        ('alice-member', 'alice', 'workspace', 'member', 1),
        ('bob-member', 'bob', 'workspace', 'member', 1),
        ('owner-member', 'owner', 'workspace', 'owner', 1),
        ('outsider-member', 'outsider', 'other-workspace', 'owner', 1)`),
    ]);
    await run(db);
  } finally {
    await runtime.dispose();
  }
};

const connect = async (
  db: D1Database,
  userId = 'alice',
  permission: 'read' | 'edit' | 'publish' = 'edit',
) => {
  const connection = await createMcpConnection(db, {
    userId,
    clientId: 'https://client.example/metadata.json',
    clientName: 'Test client',
    permission,
  });
  return attachMcpGrant(db, {
    connectionId: connection.id,
    userId,
    grantId: `grant-${connection.id}`,
  });
};

test('MCP consent defaults to draft editing and an incomplete OAuth grant cannot authorize calls', async () => {
  await withDatabase(async (db) => {
    const connection = await createMcpConnection(db, {
      userId: 'alice',
      clientId: 'client',
      clientName: 'Test client',
    });
    expect(connection.scopes).toEqual(['mcp:read', 'mcp:write']);
    expect(connection.permission).toBe('edit');
    expect(connection.organizationId).toBe('workspace');
    expect(connection.membershipId).toBe('alice-member');
    await expect(
      authorizeMcpConnection(db, {
        connectionId: connection.id,
        userId: 'alice',
        clientId: 'client',
        tokenScopes: connection.scopes,
      }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
  });
});

test('MCP intersects connection permissions with the exact token scopes', async () => {
  await withDatabase(async (db) => {
    const publisher = await connect(db, 'alice', 'publish');
    const input = {
      connectionId: publisher.id,
      userId: publisher.userId,
      clientId: publisher.clientId,
      tokenScopes: ['mcp:read'] as const,
    };
    const access = await authorizeMcpConnection(db, input);
    expect(access.scopes).toEqual(['mcp:read']);
    expect(access.connection.lastUsedAt).toBeGreaterThan(0);
    await expect(
      authorizeMcpConnection(db, { ...input, requiredScope: 'mcp:publish' }),
    ).rejects.toMatchObject({ code: 'insufficient_scope', status: 403 });

    const reader = await connect(db, 'alice', 'read');
    await expect(
      authorizeMcpConnection(db, {
        ...input,
        connectionId: reader.id,
        tokenScopes: ['mcp:read', 'mcp:write', 'mcp:publish'],
        requiredScope: 'mcp:write',
      }),
    ).rejects.toMatchObject({ code: 'insufficient_scope', status: 403 });
  });
});

test('MCP testing is a separate opt-in permission and requires read access', async () => {
  await withDatabase(async (db) => {
    const connection = await createMcpConnection(db, {
      userId: 'alice',
      clientId: 'test-client',
      clientName: 'Testing client',
      permission: 'read',
      allowTesting: true,
    });
    expect(connection.scopes).toEqual(['mcp:read', 'mcp:run']);
    expect(connection.permission).toBe('read');
    await attachMcpGrant(db, {
      connectionId: connection.id,
      userId: connection.userId,
      grantId: `grant-${connection.id}`,
    });
    const input = {
      connectionId: connection.id,
      userId: connection.userId,
      clientId: connection.clientId,
      tokenScopes: connection.scopes,
    };
    expect(
      (await authorizeMcpConnection(db, { ...input, requiredScope: 'mcp:run' }))
        .scopes,
    ).toEqual(['mcp:read', 'mcp:run']);
    for (const requiredScope of ['mcp:write', 'mcp:publish'] as const) {
      await expect(
        authorizeMcpConnection(db, { ...input, requiredScope }),
      ).rejects.toMatchObject({ code: 'insufficient_scope', status: 403 });
    }
    for (const tokenScopes of [['mcp:read'], ['mcp:run']] as const) {
      await expect(
        authorizeMcpConnection(db, {
          ...input,
          tokenScopes,
          requiredScope: 'mcp:run',
        }),
      ).rejects.toMatchObject({ code: 'insufficient_scope', status: 403 });
    }

    const existing = await connect(db, 'alice', 'publish');
    expect(existing.scopes).toEqual(['mcp:read', 'mcp:write', 'mcp:publish']);
    await expect(
      authorizeMcpConnection(db, {
        ...input,
        connectionId: existing.id,
        clientId: existing.clientId,
        requiredScope: 'mcp:run',
      }),
    ).rejects.toMatchObject({ code: 'insufficient_scope', status: 403 });
    expect(
      mcpGrantScopesSchema.safeParse(['mcp:read', 'mcp:run']).success,
    ).toBe(true);
    for (const scopes of [
      ['mcp:run'],
      ['mcp:read', 'mcp:publish', 'mcp:run'],
      ['mcp:read', 'mcp:run', 'mcp:run'],
    ]) {
      expect(mcpGrantScopesSchema.safeParse(scopes).success).toBe(false);
    }
  });
});

test('MCP rejects a connection replayed by a different user or OAuth client', async () => {
  await withDatabase(async (db) => {
    const connection = await connect(db);
    const input = {
      connectionId: connection.id,
      userId: connection.userId,
      clientId: connection.clientId,
      tokenScopes: connection.scopes,
    };
    await expect(
      authorizeMcpConnection(db, { ...input, userId: 'bob' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
    await expect(
      authorizeMcpConnection(db, { ...input, clientId: 'other-client' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
  });
});

test('MCP revocation immediately blocks unexpired tokens and is idempotent', async () => {
  await withDatabase(async (db) => {
    const connection = await connect(db);
    const input = {
      connectionId: connection.id,
      userId: connection.userId,
      clientId: connection.clientId,
      tokenScopes: connection.scopes,
    };
    await authorizeMcpConnection(db, input);
    const revoked = await revokeMcpConnection(db, input);
    expect(revoked.revokedAt).toBeGreaterThan(0);
    const repeated = await revokeMcpConnection(db, input);
    expect(repeated.revokedAt).toBe(revoked.revokedAt);
    await expect(authorizeMcpConnection(db, input)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    await expect(
      attachMcpGrant(db, { ...input, grantId: 'replacement-grant' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
  });
});

test('MCP members manage only their connections while current owners and admins manage the workspace', async () => {
  await withDatabase(async (db) => {
    const alice = await connect(db);
    const bob = await connect(db, 'bob');
    const outsider = await connect(db, 'outsider');
    const own = await listMcpConnections(db, 'alice');
    expect(own.canManageWorkspaceConnections).toBe(false);
    expect(own.connections.map((item) => item.id)).toEqual([alice.id]);
    expect(own.connections[0]?.userEmail).toBe('alice@example.com');
    await expect(
      revokeMcpConnection(db, { connectionId: bob.id, userId: 'alice' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable', status: 404 });
    const all = await listMcpConnections(db, 'owner');
    expect(all.canManageWorkspaceConnections).toBe(true);
    expect(all.connections.map((item) => item.id).sort()).toEqual(
      [alice.id, bob.id].sort(),
    );
    await expect(
      revokeMcpConnection(db, { connectionId: outsider.id, userId: 'owner' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable', status: 404 });
    await revokeMcpConnection(db, { connectionId: bob.id, userId: 'owner' });
    await db
      .prepare("UPDATE member SET role = 'admin' WHERE user_id = 'owner'")
      .run();
    expect((await listMcpConnections(db, 'owner')).connections).toHaveLength(2);
    await revokeMcpConnection(db, { connectionId: alice.id, userId: 'owner' });
    await db
      .prepare("UPDATE member SET role = 'member' WHERE user_id = 'owner'")
      .run();
    expect((await listMcpConnections(db, 'owner')).connections).toHaveLength(0);
    await expect(
      revokeMcpConnection(db, { connectionId: alice.id, userId: 'owner' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable', status: 404 });
  });
});

test('MCP membership removal blocks existing tokens even when the user later rejoins', async () => {
  await withDatabase(async (db) => {
    const connection = await connect(db);
    const input = {
      connectionId: connection.id,
      userId: connection.userId,
      clientId: connection.clientId,
      tokenScopes: connection.scopes,
    };
    await db.prepare("DELETE FROM member WHERE user_id = 'alice'").run();
    await expect(authorizeMcpConnection(db, input)).rejects.toMatchObject({
      code: 'workspace_unavailable',
    });
    await db
      .prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at)
        VALUES ('alice-rejoined', 'alice', 'workspace', 'member', 2)`)
      .run();
    await expect(authorizeMcpConnection(db, input)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    expect((await listMcpConnections(db, 'alice')).connections).toHaveLength(0);
  });
});

test('MCP fails closed when a user has multiple workspace memberships', async () => {
  await withDatabase(async (db) => {
    const connection = await connect(db);
    await db
      .prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at)
        VALUES ('alice-other', 'alice', 'other-workspace', 'member', 2)`)
      .run();
    await expect(getMcpWorkspace(db, 'alice')).rejects.toMatchObject({
      code: 'workspace_unavailable',
    });
    await expect(connect(db)).rejects.toMatchObject({
      code: 'workspace_unavailable',
    });
    await expect(
      authorizeMcpConnection(db, {
        connectionId: connection.id,
        userId: connection.userId,
        clientId: connection.clientId,
        tokenScopes: connection.scopes,
      }),
    ).rejects.toMatchObject({ code: 'workspace_unavailable' });
  });
});

test('MCP grant IDs cannot be swapped or shared between connections', async () => {
  await withDatabase(async (db) => {
    const first = await connect(db);
    const second = await createMcpConnection(db, {
      userId: 'alice',
      clientId: first.clientId,
      clientName: first.clientName,
    });
    const grantId = `grant-${first.id}`;
    const repeated = await attachMcpGrant(db, {
      connectionId: first.id,
      userId: 'alice',
      grantId,
    });
    expect(repeated.grantId).toBe(grantId);
    await expect(
      attachMcpGrant(db, {
        connectionId: first.id,
        userId: 'alice',
        grantId: 'replacement',
      }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
    await expect(
      attachMcpGrant(db, { connectionId: second.id, userId: 'alice', grantId }),
    ).rejects.toThrow('UNIQUE constraint failed');
  });
});

test('MCP authorization grants can be claimed only once, including concurrent redemption', async () => {
  await withDatabase(async (db) => {
    const connection = await createMcpConnection(db, {
      userId: 'alice',
      clientId: 'client',
      clientName: 'Test client',
    });
    const input = {
      connectionId: connection.id,
      userId: connection.userId,
      grantId: 'single-use-grant',
    };
    const results = await Promise.allSettled([
      claimMcpGrant(db, input),
      claimMcpGrant(db, input),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure).toMatchObject({
      status: 'rejected',
      reason: { code: 'connection_unavailable' },
    });
    await expect(claimMcpGrant(db, input)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    await expect(
      claimMcpGrant(db, { ...input, grantId: 'different-grant' }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
    const access = await authorizeMcpConnection(db, {
      ...input,
      clientId: connection.clientId,
      tokenScopes: connection.scopes,
    });
    expect(access.connection.grantId).toBe('single-use-grant');
  });
});

test('MCP authorization claims reject revoked connections and changed memberships', async () => {
  await withDatabase(async (db) => {
    const revoked = await createMcpConnection(db, {
      userId: 'alice',
      clientId: 'client',
      clientName: 'Test client',
    });
    const claim = {
      connectionId: revoked.id,
      userId: revoked.userId,
      grantId: 'grant',
    };
    await revokeMcpConnection(db, claim);
    await expect(claimMcpGrant(db, claim)).rejects.toMatchObject({
      code: 'connection_unavailable',
    });
    const removed = await createMcpConnection(db, {
      userId: 'alice',
      clientId: 'client',
      clientName: 'Test client',
    });
    await db.prepare("DELETE FROM member WHERE user_id = 'alice'").run();
    await expect(
      claimMcpGrant(db, { ...claim, connectionId: removed.id }),
    ).rejects.toMatchObject({ code: 'workspace_unavailable' });
    await db
      .prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at)
        VALUES ('alice-rejoined', 'alice', 'workspace', 'member', 2)`)
      .run();
    await expect(
      claimMcpGrant(db, { ...claim, connectionId: removed.id }),
    ).rejects.toMatchObject({ code: 'connection_unavailable' });
  });
});
