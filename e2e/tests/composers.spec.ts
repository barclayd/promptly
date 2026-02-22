import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can navigate to composers list page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');
  await expect(authenticatedPage).toHaveURL(ROUTES.composers);
});

test('can create a composer via dialog', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  // Click the "Create Composer" or "New Composer" button
  const createButton = authenticatedPage
    .getByRole('button', { name: /create composer|new composer/i })
    .first();
  await createButton.waitFor({ state: 'visible', timeout: 15000 });
  await createButton.click();

  // Wait for the dialog to appear
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Fill in composer name
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(`Test Composer ${Date.now()}`);

  // Submit the form
  const submitButton = dialog.getByRole('button', { name: /create/i });
  await submitButton.click();

  // Wait for navigation to the new composer detail page
  await authenticatedPage.waitForURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });
});

test('can navigate to a composer and see editor', async ({
  authenticatedPage,
}) => {
  // First ensure we have a composer by navigating to list
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  // Click on the first composer link
  const firstComposerLink = authenticatedPage
    .locator('a[href^="/composers/"]')
    .first();
  await firstComposerLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstComposerLink.click();

  // Verify URL changed to a specific composer
  await expect(authenticatedPage).toHaveURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify Tiptap editor is visible (ProseMirror container)
  await expect(authenticatedPage.locator('.ProseMirror')).toBeVisible();
});

test('composer detail has sidebar sections', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstComposerLink = authenticatedPage
    .locator('a[href^="/composers/"]')
    .first();
  await firstComposerLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstComposerLink.click();
  await expect(authenticatedPage).toHaveURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify sidebar sections exist
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Versions',
    }),
  ).toBeVisible();
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Schema Builder',
    }),
  ).toBeVisible();
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Generated Code',
    }),
  ).toBeVisible();
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Test',
    }),
  ).toBeVisible();
});

test('can edit composer content', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstComposerLink = authenticatedPage
    .locator('a[href^="/composers/"]')
    .first();
  await firstComposerLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstComposerLink.click();
  await expect(authenticatedPage).toHaveURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Find the Tiptap editor (ProseMirror)
  const editor = authenticatedPage.locator('.ProseMirror');
  await expect(editor).toBeVisible();

  // Click to focus the editor, then select all and type new content
  await editor.click();
  await authenticatedPage.keyboard.press('Meta+a');

  const testText = `Test composer content ${Date.now()}`;
  await authenticatedPage.keyboard.type(testText);

  // Verify the text was entered
  await expect(editor).toContainText(testText);
});

test('composer menubar has File and Edit menus', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstComposerLink = authenticatedPage
    .locator('a[href^="/composers/"]')
    .first();
  await firstComposerLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstComposerLink.click();
  await expect(authenticatedPage).toHaveURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify File menu exists
  await expect(
    authenticatedPage.getByRole('menubar').getByText('File'),
  ).toBeVisible();

  // Verify Edit menu exists
  await expect(
    authenticatedPage.getByRole('menubar').getByText('Edit'),
  ).toBeVisible();
});

test('composer appears in sidebar navigation', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.dashboard);
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify Composers nav item exists in sidebar
  const composersNav = authenticatedPage.locator('a[href="/composers"]', {
    hasText: 'Composers',
  });
  await expect(composersNav).toBeVisible();
});

test('no prompt refs shows warning in test panel', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.composers);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstComposerLink = authenticatedPage
    .locator('a[href^="/composers/"]')
    .first();
  await firstComposerLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstComposerLink.click();
  await expect(authenticatedPage).toHaveURL(/\/composers\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Clear content in the Tiptap editor and type static text
  const editor = authenticatedPage.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  await editor.click();
  await authenticatedPage.keyboard.press('Meta+a');
  await authenticatedPage.keyboard.type(
    'Just some static text without any prompt references',
  );

  // The warning about no prompt references should appear in the Test section
  await expect(
    authenticatedPage.locator('p', {
      hasText: 'No prompt references found',
    }),
  ).toBeVisible({ timeout: 5000 });
});
