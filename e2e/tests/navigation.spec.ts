import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

test.describe('Navigation', () => {
  test('analytics page shows coming soon message', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(ROUTES.analytics);
    await expect(authenticatedPage).toHaveURL(ROUTES.analytics);

    // Verify placeholder message is visible
    await expect(
      authenticatedPage.getByText(/analytics coming soon/i),
    ).toBeVisible();
  });

  test('team page loads successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(ROUTES.team);
    await expect(authenticatedPage).toHaveURL(ROUTES.team);

    // Verify page content is present (team heading or member list)
    const teamHeading = authenticatedPage.getByRole('heading', {
      name: /team/i,
    });
    const memberSection = authenticatedPage.getByText(/member/i);

    // Either heading or member section should be visible
    await expect(teamHeading.or(memberSection).first()).toBeVisible();
  });

  test('settings page loads successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(ROUTES.settings);
    await expect(authenticatedPage).toHaveURL(ROUTES.settings);

    // Verify settings content is present
    const apiKeysSection = authenticatedPage.getByText(/api key/i);
    const settingsHeading = authenticatedPage.getByRole('heading', {
      name: /settings/i,
    });

    // Either API Keys section or Settings heading should be visible
    await expect(apiKeysSection.or(settingsHeading).first()).toBeVisible();
  });

  test('search modal opens with keyboard shortcut and closes with Escape', async ({
    authenticatedPage,
  }) => {
    // Start from home page
    await authenticatedPage.goto(ROUTES.home);

    // Wait for page to fully load
    await authenticatedPage.waitForLoadState('networkidle');

    // Press Cmd+K (use Control+k for Chromium which interprets it as the modifier)
    await authenticatedPage.keyboard.press('Control+k');

    // Verify search dialog is visible
    const searchDialog = authenticatedPage.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5000 });

    // Verify search input is present
    const searchInput = searchDialog.locator('input');
    await expect(searchInput).toBeVisible();

    // Press Escape to close
    await authenticatedPage.keyboard.press('Escape');

    // Verify dialog is closed
    await expect(searchDialog).not.toBeVisible();
  });

  test('search modal can be reopened after closing', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(ROUTES.home);
    await authenticatedPage.waitForLoadState('networkidle');

    // Open search
    await authenticatedPage.keyboard.press('Control+k');
    const searchDialog = authenticatedPage.getByRole('dialog');
    await expect(searchDialog).toBeVisible({ timeout: 5000 });

    // Close with Escape
    await authenticatedPage.keyboard.press('Escape');
    await expect(searchDialog).not.toBeVisible();

    // Reopen with Cmd+K
    await authenticatedPage.keyboard.press('Control+k');
    await expect(searchDialog).toBeVisible({ timeout: 5000 });
  });
});
