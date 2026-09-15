import { handleMcpOAuth } from '../../app/lib/mcp/oauth.server';
import { handleMcpApi } from '../../app/lib/mcp/protocol.server';
import { PresenceRoom } from '../../workers/presence-room';

export { PresenceRoom };

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    // Miniflare dispatch uses its local listener URL; restore the simulated
    // public Worker URL before exercising production host/resource checks.
    const path = new URL(request.url);
    const edgeRequest = new Request(
      new URL(`${path.pathname}${path.search}`, env.BETTER_AUTH_URL),
      request,
    );
    edgeRequest.headers.set('Host', new URL(env.BETTER_AUTH_URL).host);
    if (request.headers.get('X-Test-OAuth') === 'true')
      return handleMcpOAuth(edgeRequest, env, ctx);
    const permission = request.headers.get('X-Test-Permission') ?? 'publish';
    const scopes =
      permission === 'read'
        ? ['mcp:read']
        : permission === 'edit'
          ? ['mcp:read', 'mcp:write']
          : ['mcp:read', 'mcp:write', 'mcp:publish'];
    const props = {
      connectionId: `connection-${permission}`,
      userId: 'alice',
      organizationId: 'workspace',
      clientId: 'client',
      scopes: request.headers.has('X-Test-Scopes')
        ? JSON.parse(request.headers.get('X-Test-Scopes') ?? 'null')
        : scopes,
    };
    Object.defineProperty(ctx, 'props', { value: props });
    return handleMcpApi(edgeRequest, env, ctx);
  },
};
