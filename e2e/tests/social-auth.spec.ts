import { toRequestCookieHeader } from '../../app/lib/auth-cookies.server';
import { getRedirectTarget, isValidRedirectPath } from '../../app/lib/redirect';
import { action as login } from '../../app/routes/auth/login';
import { loader as completeOAuth } from '../../app/routes/auth/oauth-complete';
import { expect, test } from '../fixtures/base';
import {
  socialAuthEmail,
  socialAuthOrigin,
  socialAuthPassword,
  socialProviders,
  withSocialAuth,
} from '../fixtures/social-auth';

const authorizationPath = `/oauth/authorize?${new URLSearchParams({
  client_id: 'https://client.example.com/oauth/client.json',
  redirect_uri: 'http://127.0.0.1:49199/callback',
  response_type: 'code',
  scope: 'mcp:read mcp:write mcp:publish',
  code_challenge: 'pkce-challenge_with-base64url.characters',
  code_challenge_method: 'S256',
  state: 'original-client-state',
  resource: 'https://app.promptlycms.com/mcp',
})}`;

test('local redirects preserve complete OAuth queries without accepting external destinations', () => {
  for (const path of [
    authorizationPath,
    '/oauth/authorize?request=opaque-request-id',
    '/prompts?query=hello+world',
    '/prompts?client_id=https://client.example.com/metadata.json#details',
  ]) {
    expect(isValidRedirectPath(path)).toBe(true);
    expect(getRedirectTarget(path)).toBe(path);
  }
  for (const path of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%2f%2fevil.example',
    '/%5cevil.example',
    '/\tevil.example',
    '/\nevil.example',
    '/%0aevil.example',
    '/%invalid',
    'javascript:alert(1)',
    '/\\@evil.example',
  ]) {
    expect(isValidRedirectPath(path)).toBe(false);
    expect(getRedirectTarget(path)).toBe('/dashboard');
  }
});

test('unverified existing accounts recover from social account linking errors without losing MCP authorization', async () => {
  await withSocialAuth(async ({ auth, context, db, callback }) => {
    for (const provider of socialProviders) {
      const response = await callback(provider, authorizationPath);
      expect(response.status).toBe(302);
      const location = new URL(
        response.headers.get('Location') ?? '',
        socialAuthOrigin,
      );
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('error')).toBe('account_not_linked');
      expect(location.searchParams.get('redirectTo')).toBe(authorizationPath);
      expect(
        await db
          .prepare('SELECT id FROM account WHERE provider_id = ?')
          .bind(provider)
          .first(),
      ).toBeNull();
      expect(
        await auth.api.getSession({
          headers: { Cookie: toRequestCookieHeader(response) },
        }),
      ).toBeNull();
    }

    const signedIn = await login({
      context,
      params: {},
      url: new URL(`${socialAuthOrigin}/login`),
      pattern: '/login',
      request: new Request(`${socialAuthOrigin}/login`, {
        method: 'POST',
        body: new URLSearchParams({
          email: socialAuthEmail,
          password: socialAuthPassword,
          redirectTo: authorizationPath,
        }),
      }),
    });
    expect(signedIn).toBeInstanceOf(Response);
    if (!(signedIn instanceof Response)) throw new Error('Login failed');
    expect(signedIn.status).toBe(302);
    expect(signedIn.headers.get('Location')).toBe(authorizationPath);
    const session = await auth.api.getSession({
      headers: { Cookie: toRequestCookieHeader(signedIn) },
    });
    expect(session?.user.id).toBe('existing-user');
  });
});

test('verified existing users can connect a new verified provider on the first callback', async () => {
  await withSocialAuth(async ({ auth, db, callback }) => {
    await db.prepare('UPDATE user SET email_verified = 1').run();
    for (const provider of socialProviders) {
      const response = await callback(provider, authorizationPath);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        `/auth/oauth-complete?redirectTo=${encodeURIComponent(authorizationPath)}`,
      );
      const session = await auth.api.getSession({
        headers: { Cookie: toRequestCookieHeader(response) },
      });
      expect(session?.user.id).toBe('existing-user');
      expect(
        await db
          .prepare('SELECT user_id FROM account WHERE provider_id = ?')
          .bind(provider)
          .first(),
      ).toEqual({ user_id: 'existing-user' });
    }
    expect(
      await db.prepare('SELECT COUNT(*) AS count FROM user').first(),
    ).toEqual({ count: 1 });
  });
});

test('a provider with an unverified email cannot claim an existing verified account', async () => {
  await withSocialAuth(async ({ db, callback }) => {
    await db.prepare('UPDATE user SET email_verified = 1').run();
    for (const provider of socialProviders) {
      const response = await callback(provider, authorizationPath, false);
      const location = new URL(
        response.headers.get('Location') ?? '',
        socialAuthOrigin,
      );
      expect(location.searchParams.get('error')).toBe('account_not_linked');
      expect(location.searchParams.get('redirectTo')).toBe(authorizationPath);
      expect(
        await db
          .prepare('SELECT id FROM account WHERE provider_id = ?')
          .bind(provider)
          .first(),
      ).toBeNull();
    }
  });
});

test('already linked accounts sign in first time even when their stored email is unverified', async () => {
  await withSocialAuth(async ({ auth, db, callback }) => {
    for (const provider of socialProviders) {
      await db.prepare('UPDATE user SET email_verified = 0').run();
      await db
        .prepare(
          'INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          provider,
          `${provider}-identity`,
          provider,
          'existing-user',
          Date.now(),
        )
        .run();
      const response = await callback(provider, authorizationPath);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        `/auth/oauth-complete?redirectTo=${encodeURIComponent(authorizationPath)}`,
      );
      expect(
        (
          await auth.api.getSession({
            headers: { Cookie: toRequestCookieHeader(response) },
          })
        )?.user.id,
      ).toBe('existing-user');
    }
  });
});

test('social auth fallback and missing-session recovery return to the app login', async () => {
  await withSocialAuth(async ({ auth, context, callback }) => {
    const missingState = await auth.handler(
      new Request(
        `${socialAuthOrigin}/api/auth/callback/google?code=missing-state`,
      ),
    );
    const fallback = new URL(missingState.headers.get('Location') ?? '');
    expect(fallback.pathname).toBe('/login');
    expect(fallback.searchParams.get('error')).toBe('state_not_found');
    const externalRedirect = await callback('google', '//evil.example');
    const safeLocation = new URL(
      externalRedirect.headers.get('Location') ?? '',
      socialAuthOrigin,
    );
    expect(safeLocation.origin).toBe(socialAuthOrigin);
    expect(safeLocation.pathname).toBe('/login');
    expect(safeLocation.searchParams.has('redirectTo')).toBe(false);
    const missingSession = await completeOAuth({
      context,
      params: {},
      url: new URL(`${socialAuthOrigin}/auth/oauth-complete`),
      pattern: '/auth/oauth-complete',
      request: new Request(
        `${socialAuthOrigin}/auth/oauth-complete?redirectTo=${encodeURIComponent(authorizationPath)}`,
      ),
    });
    expect(missingSession.headers.get('Location')).toBe(
      `/login?redirectTo=${encodeURIComponent(authorizationPath)}`,
    );
  });
});

test('MCP login explains the correct sign-in method and renders recoverable errors in both themes', async ({
  page,
}, testInfo) => {
  const loginPath = `/login?redirectTo=${encodeURIComponent(authorizationPath)}`;
  await page.goto(loginPath);
  await expect(
    page.getByText('Sign in to connect your AI app to Promptly'),
  ).toBeVisible();
  await expect(
    page.getByText(/Use the same email and sign-in method/),
  ).toBeVisible();
  await page.goto(`${loginPath}&error=account_not_linked`);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate(
        (enabled) => document.documentElement.classList.toggle('dark', enabled),
        dark,
      );
      await expect(page.getByRole('alert')).toContainText(
        'Use your usual Promptly sign-in method',
      );
      await expect(page.getByRole('alert')).toContainText(
        'Your connection request will continue',
      );
      await expect(
        page.getByRole('button', { name: 'Login', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `login-recovery-${width}-${dark ? 'dark' : 'light'}.png`,
        ),
        fullPage: true,
      });
    }
  }
  const targets = await page
    .locator('input[name="redirectTo"]')
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  expect(targets).toEqual(Array(4).fill(authorizationPath));
  await page.goto(
    `${loginPath}&error=untrusted-provider-error&error_description=untrusted-detail`,
  );
  await expect(page.getByRole('alert')).toContainText(
    'Sign-in could not be completed',
  );
  await expect(page.getByRole('alert')).not.toContainText('untrusted');
});
