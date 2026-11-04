import { externalMcpServersSchema } from '../validations/mcp-external';
import { getMcpUrl, isMcpEnabled } from './config.server';

// A service Promptly signs people in to, from the MCP_EXTERNAL_SERVERS secret
// or registered by a workspace admin. Only its key's SHA-256 is kept.
export type ExternalMcpServer = {
  id: string;
  name: string;
  resource: string;
  organizationId: string;
  keyHash: string;
};

export const hashExternalMcpKey = async (key: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');

export const getConfiguredExternalMcpServers = (
  env: Env & { MCP_EXTERNAL_SERVERS?: string },
) => {
  if (!isMcpEnabled(env)) return [];
  try {
    const parsed = externalMcpServersSchema.safeParse(
      JSON.parse(env.MCP_EXTERNAL_SERVERS ?? '[]'),
    );
    if (
      !parsed.success ||
      parsed.data.some((server) => server.resource === getMcpUrl(env))
    )
      return [];
    return parsed.data;
  } catch {
    return [];
  }
};

type ExternalMcpServerRow = {
  id: string;
  organization_id: string;
  name: string;
  resource: string;
  key_hash: string;
};

// The secret wins: a workspace server that shares an ID or resource with one is ignored.
export const findExternalMcpServer = async (
  env: Env,
  lookup: { id: string } | { resource: string },
): Promise<ExternalMcpServer | undefined> => {
  if (!isMcpEnabled(env)) return undefined;
  const configured = getConfiguredExternalMcpServers(env);
  const match = configured.find((server) =>
    'id' in lookup
      ? server.id === lookup.id
      : server.resource === lookup.resource,
  );
  if (match)
    return {
      id: match.id,
      name: match.name,
      resource: match.resource,
      organizationId: match.organizationId,
      keyHash: await hashExternalMcpKey(match.sharedSecret),
    };
  const row = await env.promptly
    .withSession('first-primary')
    .prepare(
      `SELECT id, organization_id, name, resource, key_hash FROM mcp_external_server
       WHERE ${'id' in lookup ? 'id' : 'resource'} = ?`,
    )
    .bind('id' in lookup ? lookup.id : lookup.resource)
    .first<ExternalMcpServerRow>();
  if (
    !row ||
    row.resource === getMcpUrl(env) ||
    configured.some(
      (server) => server.id === row.id || server.resource === row.resource,
    )
  )
    return undefined;
  return {
    id: row.id,
    name: row.name,
    resource: row.resource,
    organizationId: row.organization_id,
    keyHash: row.key_hash,
  };
};

export const getMcpAuthorizationTarget = async (env: Env, request: Request) => {
  const resources = new URL(request.url).searchParams.getAll('resource');
  if (
    resources.length === 0 ||
    (resources.length === 1 && resources[0] === getMcpUrl(env))
  )
    return { resource: getMcpUrl(env), externalServer: undefined };
  const externalServer =
    resources.length === 1
      ? await findExternalMcpServer(env, { resource: resources[0] })
      : undefined;
  if (!externalServer)
    throw new Response('This MCP resource is not available.', { status: 400 });
  return { resource: externalServer.resource, externalServer };
};
