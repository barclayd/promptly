import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

test.describe('Theme Toggle', () => {
  test('can toggle to dark mode via user menu', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(ROUTES.home);
    await authenticatedPage.waitForLoadState('networkidle');

    // Open user dropdown - find the button with user name/email in sidebar
    const userMenuButton = authenticatedPage
      .locator('button')
      .filter({
        has: authenticatedPage.locator('img, span.rounded-lg'),
      })
      .filter({
        hasText: /Scott McTester|test@/i,
      });
    await expect(userMenuButton).toBeVisible();
    await userMenuButton.click();

    // Wait for dropdown menu to appear
    const dropdownContent = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownContent).toBeVisible();

    // Find and hover over "Toggle Theme" submenu trigger
    const themeSubmenuTrigger = dropdownContent.getByText(/toggle theme/i);
    await themeSubmenuTrigger.hover();

    // Wait for submenu to appear (second menu)
    await authenticatedPage.waitForTimeout(200); // Give submenu time to open
    const darkOption = authenticatedPage.getByRole('menuitemradio', {
      name: /dark/i,
    });
    await expect(darkOption).toBeVisible();

    // Select "Dark" mode
    await darkOption.click();

    // Verify document has dark class
    const hasDarkClass = await authenticatedPage.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(hasDarkClass).toBe(true);

    // Verify localStorage was updated
    const themeValue = await authenticatedPage.evaluate(() => {
      return localStorage.getItem('theme');
    });
    expect(themeValue).toBe('dark');
  });

  test('theme persists after page reload', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(ROUTES.home);

    // Set theme to dark via localStorage directly for faster test
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('theme', 'dark');
    });

    // Reload the page
    await authenticatedPage.reload();

    // Verify dark mode is applied after reload
    const hasDarkClass = await authenticatedPage.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(hasDarkClass).toBe(true);

    // Set back to light
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('theme', 'light');
    });

    await authenticatedPage.reload();

    // Verify light mode
    const hasDarkClassAfter = await authenticatedPage.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(hasDarkClassAfter).toBe(false);
  });

  test('system theme option respects OS preference', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(ROUTES.home);

    // Set theme to system
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('theme', 'system');
    });

    // Emulate dark mode preference
    await authenticatedPage.emulateMedia({ colorScheme: 'dark' });
    await authenticatedPage.reload();

    // Verify dark mode is applied
    const hasDarkClass = await authenticatedPage.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(hasDarkClass).toBe(true);

    // Emulate light mode preference
    await authenticatedPage.emulateMedia({ colorScheme: 'light' });
    await authenticatedPage.reload();

    // Verify light mode
    const hasDarkClassAfter = await authenticatedPage.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(hasDarkClassAfter).toBe(false);
  });
});
