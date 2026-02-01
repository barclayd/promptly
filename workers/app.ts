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

// Serve pre-rendered landing page from KV for all users
// Auth state doesn't matter - login/signup buttons redirect authenticated users
const servePrerenderedLanding = async (
  request: Request,
  env: Env,
): Promise<Response | null> => {
  const url = new URL(request.url);

  // Only handle landing page GET requests
  if (url.pathname !== '/' || request.method !== 'GET') return null;

  // Try to get pre-rendered HTML from KV
  try {
    const html = await env.PRERENDER_CACHE.get('landing-page', 'text');
    if (!html) return null;

    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control':
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      Link: '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
      'X-Prerendered': 'true',
    });

    return new Response(html, { status: 200, headers });
  } catch {
    // KV error - fall back to SSR
    return null;
  }
};

export default {
  async fetch(request, env, ctx) {
    // Handle presence WebSocket requests before React Router
    const presenceResponse = await handlePresenceWebSocket(request, env);
    if (presenceResponse) {
      return presenceResponse;
    }

    // Try to serve pre-rendered landing page (faster than SSR)
    const prerenderedResponse = await servePrerenderedLanding(request, env);
    if (prerenderedResponse) {
      return prerenderedResponse;
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

      // Early Hints: preconnect to Google Fonts for faster font loading
      // Cloudflare caches these Link headers and serves them in 103 responses
      headers.append(
        'Link',
        '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
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
