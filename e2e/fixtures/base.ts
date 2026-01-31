import { test as base, expect, type Page } from '@playwright/test';
import { ROUTES, TEST_USER } from '../helpers/test-data';

/**
 * Login helper that authenticates the user
 */
export const login = async (page: Page) => {
  await page.goto(ROUTES.login);
  await page.waitForLoadState('domcontentloaded');

  // Wait for form fields to be visible and interactive
  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');

  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await emailField.fill(TEST_USER.email);

  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(TEST_USER.password);

  const loginButton = page.getByRole('button', { name: 'Login', exact: true });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  await loginButton.click();

  // Wait for navigation to complete after login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30000,
  });

  // Wait for the authenticated page to be fully loaded
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
    await use(page);
  },
});

export { expect };
