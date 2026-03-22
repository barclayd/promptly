import { expect, test } from '../fixtures/base';
import { ROUTES, TEST_USER } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('unauthenticated user visiting protected route is redirected to login with redirectTo param', async ({
  page,
}) => {
  await page.goto(ROUTES.prompts);

  // Should be redirected to login with the original URL preserved
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprompts/);
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible();
});

test('login redirects to original URL instead of dashboard', async ({
  page,
}) => {
  // Go to a protected route while unauthenticated
  await page.goto(ROUTES.settings);
  await page.waitForURL(/\/login\?redirectTo/, { timeout: 10000 });

  // Fill in credentials and submit
  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');

  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await emailField.fill(TEST_USER.email);

  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(TEST_USER.password);

  const loginButton = page.getByRole('button', { name: 'Login', exact: true });
  await loginButton.click();

  // Should redirect to settings, not dashboard
  await page.waitForURL(/\/settings/, { timeout: 30000 });
  await expect(page).toHaveURL(ROUTES.settings);
});

test('login without redirectTo param goes to dashboard', async ({ page }) => {
  // Go directly to login (no redirectTo)
  await page.goto(ROUTES.login);

  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');

  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await emailField.fill(TEST_USER.email);

  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(TEST_USER.password);

  const loginButton = page.getByRole('button', { name: 'Login', exact: true });
  await loginButton.click();

  // Should redirect to dashboard (default)
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await expect(page).toHaveURL(ROUTES.dashboard);
});

test('sign up link preserves redirectTo param', async ({ page }) => {
  await page.goto('/login?redirectTo=%2Fcomposers');

  const signUpLink = page.getByRole('link', { name: 'Sign up' });
  await expect(signUpLink).toBeVisible();
  await expect(signUpLink).toHaveAttribute(
    'href',
    '/sign-up?redirectTo=%2Fcomposers',
  );
});

test('sign in link on signup page preserves redirectTo param', async ({
  page,
}) => {
  await page.goto('/sign-up?redirectTo=%2Fanalytics');

  const signInLink = page.getByRole('link', { name: 'Sign in' });
  await expect(signInLink).toBeVisible();
  await expect(signInLink).toHaveAttribute(
    'href',
    '/login?redirectTo=%2Fanalytics',
  );
});

test('malicious redirectTo is rejected and falls back to dashboard', async ({
  page,
}) => {
  await page.goto('/login?redirectTo=https://evil.com');

  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');

  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await emailField.fill(TEST_USER.email);

  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(TEST_USER.password);

  const loginButton = page.getByRole('button', { name: 'Login', exact: true });
  await loginButton.click();

  // Should fall back to dashboard, NOT redirect to evil.com
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await expect(page).toHaveURL(ROUTES.dashboard);
});

test('authenticated user visiting login with redirectTo is sent to target', async ({
  authenticatedPage,
}) => {
  // authenticatedPage is already logged in via fixture
  // Visit login with a redirectTo — should skip login and go to target
  await authenticatedPage.goto('/login?redirectTo=%2Fteam');

  await expect(authenticatedPage).toHaveURL(ROUTES.team);
});
