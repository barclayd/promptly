import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  type CreateMcpConnectionInput,
  createMcpConnectionSchema,
  type McpPermission,
  type McpScope,
  mcpGrantScopesSchema,
  mcpScopesSchema,
  permissionForMcpScopes,
  scopesForMcpPermission,
} from '../validations/mcp';

export type McpConnectionErrorCode =
  | 'invalid_request'
  | 'workspace_unavailable'
  | 'connection_unavailable'
  | 'insufficient_scope';

export class McpConnectionError extends Error {
  readonly code: McpConnectionErrorCode;
  readonly status: number;

  constructor(code: McpConnectionErrorCode, message: string, status: number) {
    super(message);
    this.name = 'McpConnectionError';
    this.code = code;
    this.status = status;
  }
}

export type McpWorkspace = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'member';
};

export type McpConnection = {
  id: string;
  userId: string;
  organizationId: string;
  membershipId: string;
  clientId: string;
  clientName: string;
  scopes: McpScope[];
  permission: McpPermission;
  grantId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

export type McpAccess = {
  connection: McpConnection;
  workspace: McpWorkspace;
  scopes: McpScope[];
};

export type McpConnectionListItem = McpConnection & {
  userName: string;
  userEmail: string;
};

type McpConnectionRow = {
  id: string;
  user_id: string;
  organization_id: string;
  membership_id: string;
  client_id: string;
  client_name: string;
  scopes: string;
  grant_id: string | null;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};

const workspaceRowSchema = z.object({
  membership_id: z.string(),
  organization_id: z.string(),
  organization_name: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
});

const workspaceUnavailable = () =>
  new McpConnectionError(
    'workspace_unavailable',
    'MCP requires one current workspace membership. Sign in to Promptly to check your workspace access.',
    403,
  );

const connectionUnavailable = (status = 401) =>
  new McpConnectionError(
    'connection_unavailable',
    'This MCP connection is unavailable. Reconnect from Promptly Settings.',
    status,
  );

const getWorkspace = async (
  db: D1DatabaseSession,
  userId: string,
): Promise<McpWorkspace> => {
  const { results } = await db
    .prepare(
      `SELECT m.id AS membership_id, m.organization_id,
              o.name AS organization_name, m.role
       FROM member m JOIN organization o ON o.id = m.organization_id
       WHERE m.user_id = ? LIMIT 2`,
    )
    .bind(userId)
    .all();
  if (results.length !== 1) throw workspaceUnavailable();
  const result = workspaceRowSchema.safeParse(results[0]);
  if (!result.success) throw workspaceUnavailable();
  return {
    membershipId: result.data.membership_id,
    organizationId: result.data.organization_id,
    organizationName: result.data.organization_name,
    role: result.data.role,
  };
};

const toConnection = (row: McpConnectionRow): McpConnection => {
  let scopes: McpScope[];
  try {
    scopes = mcpGrantScopesSchema.parse(JSON.parse(row.scopes));
  } catch {
    throw connectionUnavailable();
  }
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    membershipId: row.membership_id,
    clientId: row.client_id,
    clientName: row.client_name,
    scopes,
    permission: permissionForMcpScopes(scopes),
    grantId: row.grant_id,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
};

export const getMcpWorkspace = (
  db: D1Database,
  userId: string,
): Promise<McpWorkspace> =>
  getWorkspace(db.withSession('first-primary'), userId);

export const createMcpConnection = async (
  db: D1Database,
  input: CreateMcpConnectionInput,
): Promise<McpConnection> => {
  const result = createMcpConnectionSchema.safeParse(input);
  if (!result.success) {
    throw new McpConnectionError(
      'invalid_request',
      'The MCP client or permission is invalid.',
      400,
    );
  }
  const { userId, clientId, clientName, permission } = result.data;
  const session = db.withSession('first-primary');
  const workspace = await getWorkspace(session, userId);
  const row = await session
    .prepare(
      `INSERT INTO mcp_connection
         (id, user_id, organization_id, membership_id, client_id, client_name, scopes, created_at)
       SELECT ?, m.user_id, m.organization_id, m.id, ?, ?, ?, ?
       FROM member m
       WHERE m.id = ? AND m.user_id = ? AND m.organization_id = ?
         AND m.role IN ('owner', 'admin', 'member')
         AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1
       RETURNING *`,
    )
    .bind(
      nanoid(),
      clientId,
      clientName,
      JSON.stringify(scopesForMcpPermission(permission)),
      Date.now(),
      workspace.membershipId,
      userId,
      workspace.organizationId,
      userId,
    )
    .first<McpConnectionRow>();
  if (!row) throw workspaceUnavailable();
  return toConnection(row);
};

type McpGrantInput = {
  connectionId: string;
  userId: string;
  grantId: string;
};

const setMcpGrant = async (
  db: D1Database,
  input: McpGrantInput,
  allowExisting: boolean,
): Promise<McpConnection> => {
  if (!input.grantId || input.grantId.length > 2048) {
    throw new McpConnectionError(
      'invalid_request',
      'Invalid OAuth grant.',
      400,
    );
  }
  const session = db.withSession('first-primary');
  const workspace = await getWorkspace(session, input.userId);
  const row = await session
    .prepare(
      `UPDATE mcp_connection SET grant_id = ?
       WHERE id = ? AND user_id = ? AND organization_id = ?
         AND membership_id = ? AND revoked_at IS NULL
         AND (grant_id IS NULL OR (? = 1 AND grant_id = ?))
         AND EXISTS (
           SELECT 1 FROM member WHERE id = mcp_connection.membership_id
             AND user_id = mcp_connection.user_id
             AND organization_id = mcp_connection.organization_id
             AND role IN ('owner', 'admin', 'member')
         )
         AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1
       RETURNING *`,
    )
    .bind(
      input.grantId,
      input.connectionId,
      input.userId,
      workspace.organizationId,
      workspace.membershipId,
      allowExisting ? 1 : 0,
      input.grantId,
      input.userId,
    )
    .first<McpConnectionRow>();
  if (!row) throw connectionUnavailable();
  return toConnection(row);
};

export const attachMcpGrant = (
  db: D1Database,
  input: McpGrantInput,
): Promise<McpConnection> => setMcpGrant(db, input, true);

export const claimMcpGrant = (
  db: D1Database,
  input: McpGrantInput,
): Promise<McpConnection> => setMcpGrant(db, input, false);

export const authorizeMcpConnection = async (
  db: D1Database,
  input: {
    connectionId: string;
    userId: string;
    clientId: string;
    tokenScopes: readonly McpScope[];
    requiredScope?: McpScope;
  },
): Promise<McpAccess> => {
  const tokenScopes = mcpScopesSchema.safeParse(input.tokenScopes);
  if (!tokenScopes.success) throw connectionUnavailable();
  const session = db.withSession('first-primary');
  const workspace = await getWorkspace(session, input.userId);
  const row = await session
    .prepare(
      `SELECT * FROM mcp_connection
       WHERE id = ? AND user_id = ? AND client_id = ?
         AND organization_id = ? AND membership_id = ?
         AND revoked_at IS NULL AND grant_id IS NOT NULL`,
    )
    .bind(
      input.connectionId,
      input.userId,
      input.clientId,
      workspace.organizationId,
      workspace.membershipId,
    )
    .first<McpConnectionRow>();
  if (!row) throw connectionUnavailable();
  const connection = toConnection(row);
  const scopes = connection.scopes.filter((scope) =>
    tokenScopes.data.includes(scope),
  );
  if (!scopes.includes(input.requiredScope ?? 'mcp:read')) {
    throw new McpConnectionError(
      'insufficient_scope',
      'This connection does not have permission for this MCP operation.',
      403,
    );
  }
  const lastUsedAt = Date.now();
  const result = await session
    .prepare(
      `UPDATE mcp_connection SET last_used_at = ?
       WHERE id = ? AND revoked_at IS NULL AND scopes = ?
         AND EXISTS (
           SELECT 1 FROM member WHERE id = mcp_connection.membership_id
             AND user_id = mcp_connection.user_id
             AND organization_id = mcp_connection.organization_id
             AND role IN ('owner', 'admin', 'member')
         )
         AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1`,
    )
    .bind(lastUsedAt, connection.id, row.scopes, input.userId)
    .run();
  if (result.meta.changes !== 1) throw connectionUnavailable();
  return {
    connection: { ...connection, lastUsedAt },
    workspace,
    scopes,
  };
};

export const listMcpConnections = async (
  db: D1Database,
  userId: string,
): Promise<{
  workspace: McpWorkspace;
  canManageWorkspaceConnections: boolean;
  connections: McpConnectionListItem[];
}> => {
  const session = db.withSession('first-primary');
  const workspace = await getWorkspace(session, userId);
  const { results } = await session
    .prepare(
      `SELECT c.*, u.name AS user_name, u.email AS user_email FROM mcp_connection c
       JOIN user u ON u.id = c.user_id
       JOIN member actor ON actor.id = ? AND actor.user_id = ?
         AND actor.organization_id = c.organization_id
       WHERE c.organization_id = ?
         AND (actor.role IN ('owner', 'admin') OR
              (actor.role = 'member' AND c.user_id = actor.user_id))
         AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .bind(workspace.membershipId, userId, workspace.organizationId, userId)
    .all<McpConnectionRow & { user_name: string; user_email: string }>();
  return {
    workspace,
    canManageWorkspaceConnections:
      workspace.role === 'owner' || workspace.role === 'admin',
    connections: results.map((row) => ({
      ...toConnection(row),
      userName: row.user_name,
      userEmail: row.user_email,
    })),
  };
};

export const revokeMcpConnection = async (
  db: D1Database,
  input: { connectionId: string; userId: string },
): Promise<McpConnection> => {
  const session = db.withSession('first-primary');
  const workspace = await getWorkspace(session, input.userId);
  const row = await session
    .prepare(
      `UPDATE mcp_connection SET revoked_at = COALESCE(revoked_at, ?)
       WHERE id = ? AND organization_id = ?
         AND EXISTS (
           SELECT 1 FROM member actor
           WHERE actor.id = ? AND actor.user_id = ?
             AND actor.organization_id = mcp_connection.organization_id
             AND (actor.role IN ('owner', 'admin') OR
                  (actor.role = 'member' AND mcp_connection.user_id = actor.user_id))
         )
         AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1
       RETURNING *`,
    )
    .bind(
      Date.now(),
      input.connectionId,
      workspace.organizationId,
      workspace.membershipId,
      input.userId,
      input.userId,
    )
    .first<McpConnectionRow>();
  if (!row) throw connectionUnavailable(404);
  return toConnection(row);
};
