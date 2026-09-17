import { randomUUID } from 'node:crypto';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { RouterContextProvider } from 'react-router';
import { cloudflareContext } from '../../app/context';
import { getAuth } from '../../app/lib/auth.server';
import { toRequestCookieHeader } from '../../app/lib/auth-cookies.server';
import { hashPassword } from '../../app/lib/password.server';
import { action as startSocial } from '../../app/routes/auth/social';
import { applyAuthoringFixtureMigration } from './authoring-database';

export const socialAuthOrigin = 'https://auth.promptly.test';
export const socialAuthEmail = 'existing-user@example.com';
export const socialAuthPassword = 'Existing-user-password-123';
export const socialProviders = ['apple', 'google', 'github'] as const;

export const withSocialAuth = async (
  run: (fixture: {
    auth: ReturnType<typeof getAuth>;
    context: RouterContextProvider;
    db: D1Database;
    callback: (
      provider: (typeof socialProviders)[number],
      redirectTo: string,
      verified?: boolean,
    ) => Promise<Response>;
  }) => Promise<void>,
) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch: () => new Response("Auth test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['promptly'],
      kvNamespaces: ['AUTH_CACHE'],
      bindings: {
        BETTER_AUTH_URL: socialAuthOrigin,
        BETTER_AUTH_SECRET: randomUUID(),
        GOOGLE_CLIENT_ID: 'test-google-client',
        GOOGLE_CLIENT_SECRET: 'test-google-secret',
        APPLE_CLIENT_ID: 'test-apple-client',
        APPLE_CLIENT_SECRET: 'test-apple-secret',
        GITHUB_CLIENT_ID: 'test-github-client',
        GITHUB_CLIENT_SECRET: 'test-github-secret',
      },
    }),
  );

  try {
    const db = await runtime.getD1Database('promptly');
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
    ]) {
      await applyAuthoringFixtureMigration(db, name);
    }
    await db
      .prepare('INSERT INTO user (id, name, email) VALUES (?, ?, ?)')
      .bind('existing-user', 'Existing user', socialAuthEmail)
      .run();
    await db
      .prepare(
        'INSERT INTO account (id, account_id, provider_id, user_id, password, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        'credential-account',
        'existing-user',
        'credential',
        'existing-user',
        await hashPassword(socialAuthPassword),
        Date.now(),
      )
      .run();

    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      env: await runtime.getBindings<Env>(),
      ctx: {} as ExecutionContext,
    });
    const auth = getAuth(context);
    const authContext = await auth.$context;

    const callback = async (
      provider: (typeof socialProviders)[number],
      redirectTo: string,
      verified = true,
    ) => {
      const configuredProvider = authContext.socialProviders.find(
        (candidate) => candidate.id === provider,
      );
      if (!configuredProvider) throw new Error(`Missing provider: ${provider}`);

      // Stub the provider transport only; state, callback, linking, D1, and
      // session creation use the installed production Better Auth config.
      configuredProvider.createAuthorizationURL = async ({ state }) => {
        const url = new URL('https://identity-provider.test/authorize');
        url.searchParams.set('state', state);
        return url;
      };
      configuredProvider.validateAuthorizationCode = async () => ({
        accessToken: 'test-provider-access-token',
      });
      configuredProvider.getUserInfo = async () => ({
        user: {
          name: 'Existing user',
          email: socialAuthEmail,
          emailVerified: verified,
        },
        data: {
          id: `${provider}-identity`,
          sub: `${provider}-identity`,
          email: socialAuthEmail,
          email_verified: verified,
        },
      });

      const response = await startSocial({
        context,
        params: {},
        url: new URL(`${socialAuthOrigin}/auth/social`),
        pattern: '/auth/social',
        request: new Request(`${socialAuthOrigin}/auth/social`, {
          method: 'POST',
          headers: { Origin: socialAuthOrigin },
          body: new URLSearchParams({ provider, redirectTo }),
        }),
      });
      const authorizationUrl = new URL(response.headers.get('Location') ?? '');
      const callbackUrl = new URL(
        `/api/auth/callback/${provider}`,
        socialAuthOrigin,
      );
      callbackUrl.searchParams.set('code', 'test-authorization-code');
      callbackUrl.searchParams.set(
        'state',
        authorizationUrl.searchParams.get('state') ?? '',
      );
      return auth.handler(
        new Request(callbackUrl, {
          headers: { Cookie: toRequestCookieHeader(response) },
        }),
      );
    };

    await run({ auth, context, db, callback });
  } finally {
    await runtime.dispose();
  }
};
