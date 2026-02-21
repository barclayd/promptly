import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can delete a snippet via File menu', async ({ authenticatedPage }) => {
  // Create a fresh snippet for this test to avoid affecting other tests
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();
  await newSnippetCard.waitFor({ state: 'visible', timeout: 15000 });
  await newSnippetCard.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const snippetName = `E2E Delete Snippet ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(snippetName);

  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();

  // Wait for dialog to close (indicates form submission completed)
  await expect(dialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect to new snippet
  await authenticatedPage.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the snippet name is displayed
  await expect(authenticatedPage.locator('h1')).toContainText(snippetName);

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
  await expect(deleteDialog.getByText(snippetName)).toBeVisible();

  // Click the Delete button to confirm
  const deleteButton = deleteDialog.getByRole('button', { name: 'Delete' });
  await deleteButton.click();

  // Wait for dialog to close (indicates deletion completed)
  await expect(deleteDialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect to snippets page
  await expect(authenticatedPage).toHaveURL(ROUTES.snippets, {
    timeout: 30000,
  });

  // Verify the snippet no longer appears in the main content area
  await authenticatedPage.waitForLoadState('networkidle');
  const snippetHeading = authenticatedPage
    .locator('main')
    .getByRole('heading', { name: snippetName });
  await expect(snippetHeading).not.toBeVisible({ timeout: 5000 });
});

test('cancel button in delete dialog preserves snippet', async ({
  authenticatedPage,
}) => {
  // Navigate to snippets page and open first snippet
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstSnippetLink = authenticatedPage
    .locator('a[href^="/snippets/"]')
    .first();
  await firstSnippetLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstSnippetLink.click();

  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Get the snippet name from the h1 heading after page loads
  const h1 = authenticatedPage.locator('h1');
  await expect(h1).toBeVisible();
  const snippetName = await h1.textContent();

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

  // Verify we're still on the snippet page
  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/);

  // Verify snippet name is still displayed
  await expect(authenticatedPage.locator('h1')).toContainText(
    snippetName ?? '',
  );
});

test('copy snippet ID via File > Share menu copies ID to clipboard', async ({
  authenticatedPage,
  context,
}) => {
  // Grant clipboard permissions
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Navigate to snippets page and open first snippet
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstSnippetLink = authenticatedPage
    .locator('a[href^="/snippets/"]')
    .first();
  await firstSnippetLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstSnippetLink.click();

  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Wait for page to fully load
  await authenticatedPage.waitForLoadState('networkidle');

  // Extract the snippet ID from the URL
  const url = authenticatedPage.url();
  const expectedSnippetId = url.split('/snippets/')[1];

  // Open File > Share > Copy Snippet ID
  const fileMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('File');
  await fileMenuTrigger.waitFor({ state: 'visible', timeout: 10000 });
  await fileMenuTrigger.click();

  const shareItem = authenticatedPage.getByRole('menuitem', {
    name: 'Share',
  });
  await shareItem.click();

  const copySnippetIdItem = authenticatedPage.getByRole('menuitem', {
    name: 'Copy Snippet ID',
  });
  await expect(copySnippetIdItem).toBeVisible();
  await copySnippetIdItem.click();

  // Verify toast appears
  await expect(
    authenticatedPage.getByText('Snippet ID copied to clipboard'),
  ).toBeVisible({ timeout: 5000 });

  // Verify clipboard contains the snippet ID
  const clipboardText = await authenticatedPage.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(clipboardText).toBe(expectedSnippetId);
});

test('delete dialog shows warning about prompts referencing snippet', async ({
  authenticatedPage,
}) => {
  // Navigate to snippets page and open first snippet
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const firstSnippetLink = authenticatedPage
    .locator('a[href^="/snippets/"]')
    .first();
  await firstSnippetLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstSnippetLink.click();

  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
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
  await expect(deleteDialog.getByText('Delete snippet')).toBeVisible();
  await expect(deleteDialog.getByText(/cannot be undone/i)).toBeVisible();
  await expect(
    deleteDialog.getByText(
      /Prompts referencing this snippet will no longer resolve/i,
    ),
  ).toBeVisible();

  // Close the dialog
  const cancelButton = deleteDialog.getByRole('button', { name: 'Cancel' });
  await cancelButton.click();
  await expect(deleteDialog).not.toBeVisible();
});
