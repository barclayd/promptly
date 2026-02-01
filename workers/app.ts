import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { createRequestHandler, RouterContextProvider } from 'react-router';

export { PresenceRoom } from './presence-room';

declare module 'react-router' {
  export interface RouterContextProvider {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

type Database = Record<string, string>;

const getAuth = (env: Env) => {
  return betterAuth({
    emailAndPassword: { enabled: true },
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    secret: env.BETTER_AUTH_SECRET,
    database: {
      db: new Kysely<Database>({
        dialect: new D1Dialect({ database: env.promptly }),
        plugins: [new CamelCasePlugin()],
      }),
      type: 'sqlite',
    },
    plugins: [organization()],
  });
};

const handlePresenceWebSocket = async (
  request: Request,
  env: Env,
): Promise<Response | null> => {
  const url = new URL(request.url);

  // Check if this is a presence WebSocket request
  if (
    !url.pathname.startsWith('/api/presence/') ||
    request.headers.get('Upgrade') !== 'websocket'
  ) {
    return null;
  }

  // Extract promptId from path: /api/presence/:promptId
  const pathParts = url.pathname.split('/');
  const promptId = pathParts[3];
  if (!promptId) {
    return new Response('Missing promptId', { status: 400 });
  }

  // Validate session using Better Auth
  const auth = getAuth(env);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get the Durable Object for this prompt
  const roomId = env.PRESENCE_ROOM.idFromName(promptId);
  const room = env.PRESENCE_ROOM.get(roomId);

  // Pass user info via URL query params (more reliable for WebSocket upgrade than headers)
  const doUrl = new URL(request.url);
  doUrl.searchParams.set('userId', session.user.id);
  doUrl.searchParams.set('userName', session.user.name);
  doUrl.searchParams.set('userEmail', session.user.email);
  doUrl.searchParams.set('userImage', session.user.image || '');

  // Forward the original request with user info in URL
  // CRITICAL: Pass the original request to preserve WebSocket upgrade properties
  const doRequest = new Request(doUrl.toString(), request);

  return room.fetch(doRequest);
};

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    // Handle presence WebSocket requests before React Router
    const presenceResponse = await handlePresenceWebSocket(request, env);
    if (presenceResponse) {
      return presenceResponse;
    }

    const context = new RouterContextProvider();
    Object.assign(context, { cloudflare: { env, ctx } });
    const response = await requestHandler(request, context);

    // Add edge caching ONLY for the landing page
    // All other routes are SSR with authenticated content - don't cache
    const url = new URL(request.url);
    const isLandingPage = url.pathname === '/';
    const isHtmlResponse = response.headers
      .get('content-type')
      ?.includes('text/html');

    if (isLandingPage && isHtmlResponse) {
      const headers = new Headers(response.headers);
      // Landing page: cache at edge for 1 hour, browser always revalidates
      headers.set(
        'Cache-Control',
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
