import { externalMcpServersSchema } from '../validations/mcp-external';
import { getMcpUrl, isMcpEnabled } from './config.server';

export const getExternalMcpServers = (
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

export const getMcpAuthorizationTarget = (env: Env, request: Request) => {
  const resources = new URL(request.url).searchParams.getAll('resource');
  if (
    resources.length === 0 ||
    (resources.length === 1 && resources[0] === getMcpUrl(env))
  )
    return { resource: getMcpUrl(env), externalServer: undefined };
  const externalServer =
    resources.length === 1
      ? getExternalMcpServers(env).find(
          (server) => server.resource === resources[0],
        )
      : undefined;
  if (!externalServer)
    throw new Response('This MCP resource is not available.', { status: 400 });
  return { resource: externalServer.resource, externalServer };
};
