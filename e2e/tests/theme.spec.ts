import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can toggle to dark mode via user menu', async ({ authenticatedPage }) => {
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

  // Wait for submenu to appear
  await authenticatedPage.waitForTimeout(200);
  const darkOption = authenticatedPage.getByRole('menuitemradio', {
    name: /dark/i,
  });
  await expect(darkOption).toBeVisible();

  // Select "Dark" mode
  await darkOption.click();

  // Wait for theme to be applied
  await authenticatedPage.waitForTimeout(100);

  // Verify document has dark class
  const hasDarkClass = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClass).toBe(true);
});

test('theme persists after page reload', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.waitForLoadState('networkidle');

  // Set theme to dark via UI
  const userMenuButton = authenticatedPage
    .locator('button')
    .filter({
      has: authenticatedPage.locator('img, span.rounded-lg'),
    })
    .filter({
      hasText: /Scott McTester|test@/i,
    });
  await userMenuButton.click();

  const dropdownContent = authenticatedPage.locator('[role="menu"]');
  await expect(dropdownContent).toBeVisible();

  const themeSubmenuTrigger = dropdownContent.getByText(/toggle theme/i);
  await themeSubmenuTrigger.hover();
  await authenticatedPage.waitForTimeout(200);

  const darkOption = authenticatedPage.getByRole('menuitemradio', {
    name: /dark/i,
  });
  await darkOption.click();

  // Verify dark class is applied
  let hasDarkClass = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClass).toBe(true);

  // Reload the page
  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify dark mode persists after reload
  hasDarkClass = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClass).toBe(true);

  // Set back to light via UI
  const userMenuButton2 = authenticatedPage
    .locator('button')
    .filter({
      has: authenticatedPage.locator('img, span.rounded-lg'),
    })
    .filter({
      hasText: /Scott McTester|test@/i,
    });
  await userMenuButton2.click();

  const dropdownContent2 = authenticatedPage.locator('[role="menu"]');
  await expect(dropdownContent2).toBeVisible();

  const themeSubmenuTrigger2 = dropdownContent2.getByText(/toggle theme/i);
  await themeSubmenuTrigger2.hover();
  await authenticatedPage.waitForTimeout(200);

  const lightOption = authenticatedPage.getByRole('menuitemradio', {
    name: /light/i,
  });
  await lightOption.click();

  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify light mode
  const hasDarkClassAfter = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClassAfter).toBe(false);
});

test('system theme option respects OS preference', async ({
  authenticatedPage,
}) => {
  // Emulate dark mode preference before navigation
  await authenticatedPage.emulateMedia({ colorScheme: 'dark' });

  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.waitForLoadState('networkidle');

  // Set theme to system via UI
  const userMenuButton = authenticatedPage
    .locator('button')
    .filter({
      has: authenticatedPage.locator('img, span.rounded-lg'),
    })
    .filter({
      hasText: /Scott McTester|test@/i,
    });
  await userMenuButton.click();

  const dropdownContent = authenticatedPage.locator('[role="menu"]');
  await expect(dropdownContent).toBeVisible();

  const themeSubmenuTrigger = dropdownContent.getByText(/toggle theme/i);
  await themeSubmenuTrigger.hover();
  await authenticatedPage.waitForTimeout(200);

  const systemOption = authenticatedPage.getByRole('menuitemradio', {
    name: /system/i,
  });
  await systemOption.click();

  // Reload with dark color scheme
  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify dark mode is applied (following system preference)
  const hasDarkClass = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClass).toBe(true);

  // Emulate light mode preference
  await authenticatedPage.emulateMedia({ colorScheme: 'light' });
  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify light mode (following system preference)
  const hasDarkClassAfter = await authenticatedPage.evaluate(() => {
    return document.documentElement.classList.contains('dark');
  });
  expect(hasDarkClassAfter).toBe(false);
});
