import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can delete a prompt via File menu', async ({ authenticatedPage }) => {
  // Create a fresh prompt for this test to avoid affecting other tests
  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.waitForLoadState('networkidle');

  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const promptName = `E2E Delete Test ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(promptName);

  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();

  // Wait for dialog to close (indicates form submission completed)
  await expect(dialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect to new prompt
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the prompt name is displayed
  await expect(authenticatedPage.locator('h1')).toContainText(promptName);

  // Open File menu and click Delete
  const fileMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('File');
  await fileMenuTrigger.click();

  const deleteItem = authenticatedPage.getByRole('menuitem', {
    name: 'Delete',
  });
  await expect(deleteItem).toBeVisible();
  await deleteItem.click();

  // Verify delete confirmation dialog opens
  const deleteDialog = authenticatedPage.getByRole('dialog');
  await expect(deleteDialog).toBeVisible();

  // Verify the warning message is shown
  await expect(deleteDialog.getByText(/cannot be undone/i)).toBeVisible();
  await expect(deleteDialog.getByText(promptName)).toBeVisible();

  // Click the Delete button to confirm
  const deleteButton = deleteDialog.getByRole('button', { name: 'Delete' });
  await deleteButton.click();

  // Wait for dialog to close (indicates deletion completed)
  await expect(deleteDialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect to prompts page
  await expect(authenticatedPage).toHaveURL(ROUTES.prompts, { timeout: 30000 });

  // Verify the prompt no longer appears in the main content area
  await authenticatedPage.waitForLoadState('networkidle');
  const promptHeading = authenticatedPage
    .locator('main')
    .getByRole('heading', { name: promptName });
  await expect(promptHeading).not.toBeVisible({ timeout: 5000 });
});

test('cancel button in delete dialog preserves prompt', async ({
  authenticatedPage,
}) => {
  // Navigate to prompts page and open first prompt
  await authenticatedPage.goto(ROUTES.prompts);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstPromptLink = authenticatedPage
    .locator('a[href^="/prompts/"]')
    .first();
  await firstPromptLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstPromptLink.click();

  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Get the prompt name from the h1 heading after page loads
  const h1 = authenticatedPage.locator('h1');
  await expect(h1).toBeVisible();
  const promptName = await h1.textContent();

  // Open File menu and click Delete
  const fileMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('File');
  await fileMenuTrigger.click();

  const deleteItem = authenticatedPage.getByRole('menuitem', {
    name: 'Delete',
  });
  await deleteItem.click();

  // Verify delete confirmation dialog opens
  const deleteDialog = authenticatedPage.getByRole('dialog');
  await expect(deleteDialog).toBeVisible();

  // Click Cancel
  const cancelButton = deleteDialog.getByRole('button', { name: 'Cancel' });
  await cancelButton.click();

  // Verify dialog is closed
  await expect(deleteDialog).not.toBeVisible();

  // Verify we're still on the prompt page
  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/);

  // Verify prompt name is still displayed
  await expect(authenticatedPage.locator('h1')).toContainText(promptName ?? '');
});

test('delete dialog shows warning about production impact', async ({
  authenticatedPage,
}) => {
  // Navigate to prompts page and open first prompt
  await authenticatedPage.goto(ROUTES.prompts);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstPromptLink = authenticatedPage
    .locator('a[href^="/prompts/"]')
    .first();
  await firstPromptLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstPromptLink.click();

  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Open File menu and click Delete
  const fileMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('File');
  await fileMenuTrigger.click();

  const deleteItem = authenticatedPage.getByRole('menuitem', {
    name: 'Delete',
  });
  await deleteItem.click();

  // Verify delete confirmation dialog opens
  const deleteDialog = authenticatedPage.getByRole('dialog');
  await expect(deleteDialog).toBeVisible();

  // Verify the warning messages are shown
  await expect(deleteDialog.getByText('Delete prompt')).toBeVisible();
  await expect(deleteDialog.getByText(/cannot be undone/i)).toBeVisible();
  await expect(deleteDialog.getByText(/API requests to fail/i)).toBeVisible();

  // Close the dialog
  const cancelButton = deleteDialog.getByRole('button', { name: 'Cancel' });
  await cancelButton.click();
  await expect(deleteDialog).not.toBeVisible();
});
