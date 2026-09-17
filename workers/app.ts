import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { cloudflareContext } from '~/context';
import { maintainAuthoring } from '~/lib/authoring/outbox.server';
import { isMcpEnabled, isMcpProtocolPath } from '~/lib/mcp/config.server';
import { handleMcpOAuth } from '~/lib/mcp/oauth.server';
import { cleanupMcpTestRuns } from '~/lib/mcp/test-runs.server';
import {
  getAuthorizedPresenceDocument,
  getPresenceDocumentId,
  isTrustedPresenceOrigin,
} from '~/lib/presence-auth.server';

export { PresenceRoom } from './presence-room';

type Database = Record<string, string>;

// Module-level cache for the worker entry point auth instance
const createWorkerAuth = (env: Env) =>
  betterAuth({
    secondaryStorage: {
      get: async (key) => (await env.AUTH_CACHE.get(key)) ?? null,
      set: async (key, value, ttl) => {
        await env.AUTH_CACHE.put(key, value, {
          expirationTtl: Math.max(ttl ?? 60, 60),
        });
      },
      delete: async (key) => {
        await env.AUTH_CACHE.delete(key);
      },
      getAndDelete: async (key) => {
        const value = await env.AUTH_CACHE.get(key);
        if (value !== null) await env.AUTH_CACHE.delete(key);
        return value;
      },
      increment: async (key, ttl) => {
        const next = Number((await env.AUTH_CACHE.get(key)) ?? 0) + 1;
        await env.AUTH_CACHE.put(key, String(next), {
          expirationTtl: Math.max(ttl, 60),
        });
        return next;
      },
    },
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
    advanced: {
      database: { validateSchema: false },
    },
    plugins: [organization()],
  });

let cachedWorkerAuth: ReturnType<typeof createWorkerAuth> | null = null;
let cachedWorkerSecret: string | null = null;

const getAuth = (env: Env) => {
  if (cachedWorkerAuth && cachedWorkerSecret === env.BETTER_AUTH_SECRET) {
    return cachedWorkerAuth;
  }

  cachedWorkerAuth = createWorkerAuth(env);
  cachedWorkerSecret = env.BETTER_AUTH_SECRET;
  return cachedWorkerAuth;
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

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  const documentId = getPresenceDocumentId(url.pathname);
  if (!documentId) {
    return new Response('Invalid document ID', { status: 400 });
  }

  if (!isTrustedPresenceOrigin(request, env.BETTER_AUTH_URL)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Validate session using Better Auth
  const auth = getAuth(env);
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableRefresh: true },
  });

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const document = await getAuthorizedPresenceDocument(
    env.promptly,
    session.user.id,
    documentId,
  );
  if (!document) {
    return new Response('Not Found', { status: 404 });
  }

  const roomId = env.PRESENCE_ROOM.idFromName(document.id);
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

// Landing page is served as a static asset (build/client/index.html)
// No Worker code needed - Cloudflare serves it directly from CDN
// This function is kept as a fallback for non-GET requests or if static asset is missing

const PROBE_PATTERNS = [
  '.env',
  '.git',
  'wp-admin',
  'wp-login',
  '.php',
  'xmlrpc',
];

export default {
  scheduled: async (_controller, env, ctx) => {
    ctx.waitUntil(maintainAuthoring(env));
    ctx.waitUntil(cleanupMcpTestRuns(env.promptly));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Reject bot/security probes early to save CPU
    if (PROBE_PATTERNS.some((p) => url.pathname.includes(p))) {
      return new Response('Not Found', { status: 404 });
    }

    if (isMcpProtocolPath(url.pathname)) {
      if (!isMcpEnabled(env)) return new Response('Not Found', { status: 404 });
      return handleMcpOAuth(request, env, ctx);
    }

    // The app subdomain has no SEO value — every page is auth-gated or a
    // login wall, and `/` redirects to the marketing site. Tell crawlers to
    // deindex everything so ranking authority consolidates on the bare domain.
    // Headers (not <meta>) keep this invisible to the prerender pipeline that
    // builds the static landing page deployed to promptlycms.com.
    const isAppHost = url.hostname.startsWith('app.');
    const withNoIndex = (response: Response): Response => {
      if (!isAppHost) return response;
      const headers = new Headers(response.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };

    // Redirect app subdomain root based on session cookie presence.
    // Lightweight check avoids betterAuth instantiation + D1 query (~3-5ms CPU).
    // If cookie is expired/invalid, user hits /dashboard → middleware redirects to /login.
    if (url.pathname === '/' && isAppHost) {
      const cookieHeader = request.headers.get('Cookie') || '';
      const hasSession = cookieHeader.includes('better-auth.session_token=');
      if (hasSession) {
        return withNoIndex(Response.redirect(`${url.origin}/dashboard`, 302));
      }
      const landingUrl = url.hostname.replace('app.', '');
      return withNoIndex(Response.redirect(`https://${landingUrl}/`, 302));
    }

    // Handle presence WebSocket requests before React Router
    const presenceResponse = await handlePresenceWebSocket(request, env);
    if (presenceResponse) {
      if (presenceResponse.status === 101) return presenceResponse;
      return withNoIndex(presenceResponse);
    }

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    const response = await requestHandler(request, context);

    // Add edge caching ONLY for the landing page
    // All other routes are SSR with authenticated content - don't cache
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
      if (isAppHost) {
        headers.set('X-Robots-Tag', 'noindex, nofollow');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return withNoIndex(response);
  },
} satisfies ExportedHandler<Env>;
