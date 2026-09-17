import { test as base, expect, type Page } from '@playwright/test';
import { ROUTES, TEST_USER } from '../helpers/test-data';

export const login = async (page: Page) => {
  await page.goto(ROUTES.login);
  // Authenticate fixture setup through the real action; dedicated auth tests exercise the login UI.
  const response = await page.request.post(ROUTES.login, {
    headers: { Origin: new URL(page.url()).origin },
    form: TEST_USER,
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(ROUTES.dashboard);
  await page.goto(ROUTES.dashboard);
  await expect(page).toHaveURL(ROUTES.dashboard);

  await page.waitForLoadState('networkidle', { timeout: 15000 });
};

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    const response = await page.request.get('/api/auth/get-session');
    expect(response.ok()).toBe(true);
    const session: { user?: { id?: string } } = await response.json();
    const userId = session.user?.id;
    if (!userId) throw new Error('Authenticated fixture has no user session');

    const skipOnboarding = (id: string) => {
      localStorage.setItem(`promptly:onboarding-skipped:${id}`, '1');
    };
    await page.addInitScript(skipOnboarding, userId);
    await page.evaluate(skipOnboarding, userId);
    await page.reload({ waitUntil: 'networkidle' });
    await use(page);
  },
});

export { expect };
