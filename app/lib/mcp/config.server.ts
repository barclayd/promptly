export const getMcpOrigin = (env: Env) => new URL(env.BETTER_AUTH_URL).origin;

export const getMcpUrl = (env: Env) => `${getMcpOrigin(env)}/mcp`;

export const isMcpEnabled = (env: Env) =>
  env.MCP_ENABLED.toLowerCase() === 'true';

export const isMcpAuthoringEnabled = (
  env: Env & { MCP_AUTHORING_ENABLED?: string },
) => isMcpEnabled(env) && env.MCP_AUTHORING_ENABLED?.toLowerCase() === 'true';

export const isMcpWorkspaceEnabled = (env: Env, organizationId: string) =>
  isMcpEnabled(env) &&
  env.MCP_PILOT_WORKSPACES.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(organizationId);

export const requireMcpWorkspace = (env: Env, organizationId: string) => {
  if (!isMcpWorkspaceEnabled(env, organizationId)) {
    throw new Response('MCP is not enabled for this workspace.', {
      status: 403,
    });
  }
};

export const requireMcpSameOrigin = (request: Request, env: Env) => {
  if (request.headers.get('Origin') !== getMcpOrigin(env)) {
    throw new Response('Invalid request origin.', { status: 403 });
  }
};

export const isMcpProtocolPath = (pathname: string) =>
  pathname === '/mcp' ||
  pathname === '/oauth/token' ||
  pathname === '/oauth/register' ||
  pathname === '/.well-known/oauth-authorization-server' ||
  pathname === '/.well-known/oauth-protected-resource' ||
  pathname === '/.well-known/oauth-protected-resource/mcp';
