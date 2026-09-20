import type {
  ExternalMcpServer,
  ExternalMcpSubject,
} from '../validations/mcp-external';
import { externalMcpStoredGrantSchema } from '../validations/mcp-external';
import {
  authorizeMcpConnection,
  type McpAccess,
  McpConnectionError,
} from './connections.server';
import { getExternalMcpServers } from './external-config.server';

const unavailable = () =>
  new McpConnectionError(
    'connection_unavailable',
    'This external MCP connection is unavailable.',
    401,
  );

export const bindExternalMcpConnection = async (
  db: D1Database,
  input: { connectionId: string; userId: string; server: ExternalMcpServer },
) => {
  const result = await db
    .withSession('first-primary')
    .prepare(
      `UPDATE mcp_connection SET external_server_id = ?, external_resource = ?
     WHERE id = ? AND user_id = ? AND organization_id = ?
       AND grant_id IS NULL AND revoked_at IS NULL
       AND external_server_id IS NULL AND external_resource IS NULL
       AND NOT EXISTS (SELECT 1 FROM json_each(mcp_connection.scopes) WHERE value NOT IN ('mcp:read', 'mcp:run'))
       AND EXISTS (SELECT 1 FROM member WHERE id = mcp_connection.membership_id
         AND user_id = mcp_connection.user_id AND organization_id = mcp_connection.organization_id
         AND role IN ('owner', 'admin', 'member'))
       AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1`,
    )
    .bind(
      input.server.id,
      input.server.resource,
      input.connectionId,
      input.userId,
      input.server.organizationId,
      input.userId,
    )
    .run();
  if (result.meta.changes !== 1) throw unavailable();
};

export const assertMcpConnectionAudience = (
  env: Env,
  access: McpAccess,
  externalServerId?: string,
) => {
  if (!externalServerId) {
    if (
      access.connection.externalServerId ||
      access.connection.externalResource
    )
      throw unavailable();
    return;
  }
  const server = getExternalMcpServers(env).find(
    (item) => item.id === externalServerId,
  );
  if (
    !server ||
    access.connection.externalServerId !== server.id ||
    access.connection.externalResource !== server.resource ||
    access.workspace.organizationId !== server.organizationId ||
    access.connection.scopes.some(
      (scope) => scope !== 'mcp:read' && scope !== 'mcp:run',
    )
  )
    throw unavailable();
};

export const authorizeExternalMcpConnection = async (
  env: Env,
  server: ExternalMcpServer,
  subject: ExternalMcpSubject,
) => {
  if (subject.organizationId !== server.organizationId) throw unavailable();
  const row = await env.promptly
    .withSession('first-primary')
    .prepare(
      `SELECT client_id FROM mcp_connection WHERE id = ? AND user_id = ?
       AND organization_id = ? AND external_server_id = ? AND external_resource = ?
       AND revoked_at IS NULL AND grant_id IS NOT NULL`,
    )
    .bind(
      subject.connectionId,
      subject.userId,
      server.organizationId,
      server.id,
      server.resource,
    )
    .first<{ client_id: string }>();
  if (!row) throw unavailable();
  const access = await authorizeMcpConnection(env.promptly, {
    ...subject,
    clientId: row.client_id,
    tokenScopes: ['mcp:read', 'mcp:run'],
  });
  assertMcpConnectionAudience(env, access, server.id);
  // Provider 0.10.3 exposes no single-grant lookup. Keep this bounded storage
  // adapter aligned with the pinned provider, as with RFC 7009 revocation.
  const grant = externalMcpStoredGrantSchema.safeParse(
    await env.OAUTH_KV.get(
      `grant:${subject.userId}:${access.connection.grantId}`,
      'json',
    ),
  );
  if (
    !grant.success ||
    grant.data.id !== access.connection.grantId ||
    grant.data.userId !== subject.userId ||
    grant.data.clientId !== access.connection.clientId ||
    grant.data.resource !== server.resource ||
    grant.data.expiresAt * 1000 <= Date.now()
  )
    throw unavailable();
  const scopes = access.scopes.filter((scope) =>
    grant.data.scope.some((granted) => granted === scope),
  );
  if (!scopes.includes('mcp:read')) throw unavailable();
  return { ...access, scopes };
};
