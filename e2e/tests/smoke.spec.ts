import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(ROUTES.login);
    await expect(
      page.getByRole('button', { name: 'Login', exact: true }),
    ).toBeVisible();
  });

  test('user can login and reach home', async ({ authenticatedPage }) => {
    // authenticatedPage is already logged in via fixture
    // App redirects to home page (/) after successful login
    await expect(authenticatedPage).toHaveURL('/');
    // Verify we're authenticated by checking for user-specific elements
    await expect(authenticatedPage.getByText('Create')).toBeVisible();
  });
});
