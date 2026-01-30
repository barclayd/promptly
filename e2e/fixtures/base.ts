import { test as base, expect, type Page } from '@playwright/test';
import { ROUTES, TEST_USER } from '../helpers/test-data';

/**
 * Login helper that authenticates the user
 */
export const login = async (page: Page) => {
  await page.goto(ROUTES.login);
  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  // Wait for navigation to complete after login
  await page.waitForURL((url) => !url.pathname.includes('/login'));
};

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
