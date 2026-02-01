import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('login page loads', async ({ page }) => {
  await page.goto(ROUTES.login);
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible();
});

test('user can login and reach dashboard', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in via fixture
  // App redirects to dashboard after successful login
  await expect(authenticatedPage).toHaveURL(ROUTES.dashboard);
  // Verify we're authenticated by checking for user-specific elements
  await expect(authenticatedPage.getByText('Create')).toBeVisible();
});
