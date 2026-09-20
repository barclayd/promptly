import { RouterContextProvider } from 'react-router';
import { z } from 'zod';
import { cloudflareContext, sessionContext } from '../../app/context';
import { handleExternalMcpBridge } from '../../app/lib/mcp/external.server';
import { getMcpOAuthApi } from '../../app/lib/mcp/oauth.server';
import { handleMcpApi } from '../../app/lib/mcp/protocol.server';
import { action, loader } from '../../app/routes/oauth.authorize';
import foundation from './mcp-authoring-worker';

export { PresenceRoom } from '../../workers/presence-room';

export default {
  fetch: async (request: Request, originalEnv: Env, ctx: ExecutionContext) => {
    const env = request.headers.has('X-Test-Disable-External')
      ? { ...originalEnv, MCP_EXTERNAL_SERVERS: '[]' }
      : originalEnv;
    const path = new URL(request.url);
    const edgeRequest = new Request(
      new URL(`${path.pathname}${path.search}`, env.BETTER_AUTH_URL),
      request,
    );
    try {
      if (path.pathname === '/__fixture/kv') {
        const data = z
          .object({ key: z.string(), value: z.string().optional() })
          .parse(await request.json());
        if (data.value !== undefined)
          await env.OAUTH_KV.put(data.key, data.value);
        return Response.json(await env.OAUTH_KV.get(data.key, 'json'));
      }
      if (path.pathname === '/__fixture/client')
        return Response.json(
          await getMcpOAuthApi(env).createClient({
            clientName: 'Preview test client',
            redirectUris: ['https://client.example/callback'],
            grantTypes: ['authorization_code', 'refresh_token'],
            responseTypes: ['code'],
            tokenEndpointAuthMethod: 'none',
          }),
        );
      if (path.pathname === '/__fixture/native-props') {
        Object.defineProperty(ctx, 'props', { value: await request.json() });
        return handleMcpApi(edgeRequest, env, ctx);
      }
      if (path.pathname.startsWith('/api/mcp/external/'))
        return handleExternalMcpBridge(
          edgeRequest,
          env,
          path.pathname.split('/').at(-1) ?? '',
        );
      if (path.pathname === '/oauth/authorize') {
        const context = new RouterContextProvider();
        context.set(cloudflareContext, { env, ctx });
        const userId = request.headers.get('X-Test-User') ?? 'alice';
        const now = new Date();
        context.set(sessionContext, {
          user: {
            id: userId,
            name: 'Alice',
            email: 'alice@example.com',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
          session: {
            id: request.headers.get('X-Test-Session') ?? 'session',
            userId,
            token: 'fixture-session-token',
            expiresAt: new Date(Date.now() + 3600000),
            createdAt: now,
            updatedAt: now,
          },
        });
        const args = {
          request: edgeRequest,
          context,
          params: {},
          pattern: '/oauth/authorize',
          url: new URL(edgeRequest.url),
        };
        if (request.method === 'POST') {
          const response = await action(args);
          return response instanceof Response
            ? response
            : Response.json(response.data, response.init ?? undefined);
        }
        return Response.json(await loader(args));
      }
      return foundation.fetch(edgeRequest, env, ctx);
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
  },
};
