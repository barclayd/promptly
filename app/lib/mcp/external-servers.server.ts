import { randomBytes } from 'node:crypto';
import { getMcpOrigin } from './config.server';
import { getMcpWorkspace, McpConnectionError } from './connections.server';
import {
  getConfiguredExternalMcpServers,
  hashExternalMcpKey,
} from './external-config.server';

// Services a workspace's owners and admins register, so Promptly can sign their
// members in to them. Each gets a key, shown once, for calling the bridge.

export type ExternalMcpServerListItem = {
  id: string;
  name: string;
  resource: string;
  keyStart: string;
  createdAt: number;
  keyCreatedAt: number;
};

type ServerRow = {
  id: string;
  name: string;
  resource: string;
  key_start: string;
  created_at: number;
  key_created_at: number;
};

const toListItem = (row: ServerRow): ExternalMcpServerListItem => ({
  id: row.id,
  name: row.name,
  resource: row.resource,
  keyStart: row.key_start,
  createdAt: row.created_at,
  keyCreatedAt: row.key_created_at,
});

// Re-checked inside each write, so a role change mid-request still counts.
const ADMIN = `EXISTS (SELECT 1 FROM member WHERE id = ? AND user_id = ? AND organization_id = ?
    AND role IN ('owner', 'admin'))
  AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1`;

const requireAdmin = async (db: D1Database, userId: string) => {
  const workspace = await getMcpWorkspace(db, userId);
  if (workspace.role !== 'owner' && workspace.role !== 'admin')
    throw new McpConnectionError(
      'insufficient_scope',
      'Only workspace owners and admins can manage MCP servers.',
      403,
    );
  return {
    workspace,
    admin: [
      workspace.membershipId,
      userId,
      workspace.organizationId,
      userId,
    ] as const,
  };
};

const newKey = async () => {
  const key = `promptly_mcp_${randomBytes(32).toString('base64url')}`;
  return { key, hash: await hashExternalMcpKey(key), start: key.slice(0, 17) };
};

const notFound = () =>
  new McpConnectionError(
    'connection_unavailable',
    'This MCP server no longer exists.',
    404,
  );

export const getExternalMcpBridgeUrl = (env: Env, id: string) =>
  `${getMcpOrigin(env)}/api/mcp/external/${id}`;

export const listExternalMcpServers = async (
  db: D1Database,
  organizationId: string,
) => {
  const { results } = await db
    .withSession('first-primary')
    .prepare(
      `SELECT id, name, resource, key_start, created_at, key_created_at
       FROM mcp_external_server WHERE organization_id = ?
       ORDER BY created_at DESC, id`,
    )
    .bind(organizationId)
    .all<ServerRow>();
  return results.map(toListItem);
};

export const createExternalMcpServer = async (
  env: Env,
  userId: string,
  input: { id: string; name: string; resource: string },
) => {
  const { workspace, admin } = await requireAdmin(env.promptly, userId);
  if (new URL(input.resource).origin === getMcpOrigin(env))
    throw new McpConnectionError(
      'invalid_request',
      'Use the service’s own MCP URL, not Promptly’s.',
      400,
    );
  const taken = new McpConnectionError(
    'invalid_request',
    'An MCP server with this ID or URL already exists.',
    409,
  );
  if (
    getConfiguredExternalMcpServers(env).some(
      (server) => server.id === input.id || server.resource === input.resource,
    )
  )
    throw taken;
  const { key, hash, start } = await newKey();
  const now = Date.now();
  const row = await env.promptly
    .withSession('first-primary')
    .prepare(
      `INSERT INTO mcp_external_server
         (id, organization_id, name, resource, key_hash, key_start, created_by, created_at, key_created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${ADMIN}
       ON CONFLICT DO NOTHING
       RETURNING id, name, resource, key_start, created_at, key_created_at`,
    )
    .bind(
      input.id,
      workspace.organizationId,
      input.name,
      input.resource,
      hash,
      start,
      userId,
      now,
      now,
      ...admin,
    )
    .first<ServerRow>();
  if (!row) throw taken;
  return { server: toListItem(row), key };
};

// The old key stops working straight away.
export const rotateExternalMcpServerKey = async (
  env: Env,
  userId: string,
  id: string,
) => {
  const { workspace, admin } = await requireAdmin(env.promptly, userId);
  const { key, hash, start } = await newKey();
  const row = await env.promptly
    .withSession('first-primary')
    .prepare(
      `UPDATE mcp_external_server SET key_hash = ?, key_start = ?, key_created_at = ?
       WHERE id = ? AND organization_id = ? AND ${ADMIN}
       RETURNING id, name, resource, key_start, created_at, key_created_at`,
    )
    .bind(hash, start, Date.now(), id, workspace.organizationId, ...admin)
    .first<ServerRow>();
  if (!row) throw notFound();
  return { server: toListItem(row), key };
};

// Revokes every connection made through the server too, so re-adding it doesn't revive them.
export const deleteExternalMcpServer = async (
  env: Env,
  userId: string,
  id: string,
) => {
  const { workspace, admin } = await requireAdmin(env.promptly, userId);
  const db = env.promptly.withSession('first-primary');
  const [revoked, deleted] = await db.batch<{
    id: string;
    user_id: string;
    grant_id: string | null;
  }>([
    db
      .prepare(
        `UPDATE mcp_connection SET revoked_at = COALESCE(revoked_at, ?)
         WHERE organization_id = ? AND external_server_id = ?
           AND external_resource = (SELECT resource FROM mcp_external_server
             WHERE id = ? AND organization_id = ?)
           AND revoked_at IS NULL AND ${ADMIN}
         RETURNING id, user_id, grant_id`,
      )
      .bind(
        Date.now(),
        workspace.organizationId,
        id,
        id,
        workspace.organizationId,
        ...admin,
      ),
    db
      .prepare(
        `DELETE FROM mcp_external_server
         WHERE id = ? AND organization_id = ? AND ${ADMIN}
         RETURNING id`,
      )
      .bind(id, workspace.organizationId, ...admin),
  ]);
  if (deleted.results.length !== 1) throw notFound();
  return revoked.results;
};
