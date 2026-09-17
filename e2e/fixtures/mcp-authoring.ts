import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  convertV4MiniflareOptions,
  Miniflare,
  type V4WorkerOptionsShape,
} from 'miniflare';
import { z } from 'zod';
import {
  applyAuthoringFixtureMigration,
  initializeAuthoringFixtureDatabase,
} from './authoring-database';

export const withMcpAuthoring = async (
  run: (runtime: Miniflare, db: D1Database) => Promise<void>,
  enabled = true,
  mcpEnabled = true,
  overrides: Pick<V4WorkerOptionsShape, 'bindings' | 'outboundService'> = {},
) => {
  const temporary = await mkdtemp(join(tmpdir(), 'promptly-mcp-authoring-'));
  let runtime: Miniflare | undefined;
  try {
    const scriptPath = join(temporary, 'worker.js');
    execFileSync(
      'bun',
      [
        'build',
        fileURLToPath(new URL('./mcp-authoring-worker.ts', import.meta.url)),
        '--target=browser',
        '--external=cloudflare:*',
        '--external=node:*',
        '--outfile',
        scriptPath,
      ],
      { stdio: 'pipe' },
    );
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        name: 'promptly-mcp-authoring-test',
        modules: true,
        script: await readFile(scriptPath, 'utf8'),
        compatibilityDate: '2025-10-08',
        compatibilityFlags: [
          'nodejs_compat_v2',
          'global_fetch_strictly_public',
        ],
        d1Databases: ['promptly'],
        kvNamespaces: ['PROMPTS_CACHE', 'OAUTH_KV'],
        durableObjects: {
          PRESENCE_ROOM: { className: 'PresenceRoom', useSQLite: true },
        },
        outboundService: overrides.outboundService,
        bindings: {
          BETTER_AUTH_URL: 'https://mcp.test',
          MCP_ENABLED: String(mcpEnabled),
          MCP_ALLOW_DCR: 'false',
          MCP_AUTHORING_ENABLED: String(enabled),
          ...overrides.bindings,
        },
      }),
    );
    const db = await runtime.getD1Database('promptly');
    await initializeAuthoringFixtureDatabase(db);
    for (const name of [
      '0011_add_subscription_table.sql',
      '0012_add_organization_id_to_subscription.sql',
      '0024_mcp_connections.sql',
      '0025_mcp_authorization_requests.sql',
      '0027_authoring_persistence.sql',
      '0029_mcp_test_runs.sql',
    ])
      await applyAuthoringFixtureMigration(db, name);
    await db
      .prepare(
        "INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ('member', 'workspace', 'alice', 'owner', 1)",
      )
      .run();
    for (const permission of ['read', 'edit', 'publish']) {
      const scopes =
        permission === 'read'
          ? ['mcp:read']
          : permission === 'edit'
            ? ['mcp:read', 'mcp:write']
            : ['mcp:read', 'mcp:write', 'mcp:publish'];
      await db
        .prepare(
          "INSERT INTO mcp_connection (id, user_id, organization_id, membership_id, client_id, client_name, scopes, grant_id, created_at) VALUES (?, 'alice', 'workspace', 'member', 'client', 'Test client', ?, ?, 1)",
        )
        .bind(
          `connection-${permission}`,
          JSON.stringify(scopes),
          `grant-${permission}`,
        )
        .run();
    }
    await db
      .prepare(
        "INSERT INTO subscription (id, plan, user_id, status, organization_id, created_at, updated_at) VALUES ('subscription', 'pro', 'alice', 'active', 'workspace', 1, 1)",
      )
      .run();
    await run(runtime, db);
  } finally {
    await runtime?.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
};

export const mcpRpc = async (
  runtime: Miniflare,
  method: string,
  params: Record<string, unknown> = {},
  options: {
    legacy?: boolean;
    permission?: 'read' | 'edit' | 'publish';
    scopes?: unknown;
    oauth?: boolean;
  } = {},
) => {
  const headers: Record<string, string> = {
    Host: 'mcp.test',
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-Test-Permission': options.permission ?? 'publish',
    'MCP-Protocol-Version': options.legacy ? '2025-11-25' : '2026-07-28',
  };
  if (!options.legacy) {
    headers['Mcp-Method'] = method;
    if (typeof params.name === 'string') headers['Mcp-Name'] = params.name;
  }
  if (options.scopes !== undefined)
    headers['X-Test-Scopes'] = JSON.stringify(options.scopes);
  if (options.oauth) headers['X-Test-OAuth'] = 'true';
  const response = await runtime.dispatchFetch('https://mcp.test/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        ...(!options.legacy
          ? {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            }
          : {}),
      },
    }),
  });
  const text = await response.text();
  const data = response.headers
    .get('content-type')
    ?.startsWith('text/event-stream')
    ? text
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.slice(5)
    : text;
  const body = z
    .object({
      result: z.record(z.string(), z.unknown()).optional(),
      error: z.unknown().optional(),
    })
    .catchall(z.unknown())
    .parse(JSON.parse(data || '{}'));
  return { response, body };
};
