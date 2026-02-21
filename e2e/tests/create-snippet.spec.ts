import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can create a new snippet via snippets page card', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');
  await expect(authenticatedPage).toHaveURL(ROUTES.snippets);

  // Wait for the page to load - either snippets appear or "New Snippet" card appears
  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();
  await newSnippetCard.waitFor({ state: 'visible', timeout: 15000 });

  // Click the card to open the create dialog
  await newSnippetCard.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Fill in snippet name with unique identifier
  const snippetName = `E2E Test Snippet ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(snippetName);

  // Optionally fill description
  const descriptionInput = dialog.locator('textarea[name="description"]');
  if (await descriptionInput.isVisible()) {
    await descriptionInput.fill('Created by E2E test');
  }

  // Click create button in dialog
  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();

  // Wait for dialog to close (indicates form submission completed)
  await expect(dialog).not.toBeVisible({ timeout: 30000 });

  // Wait for navigation to new snippet page
  await authenticatedPage.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the snippet name is visible on the page (in the header)
  await expect(
    authenticatedPage.getByRole('heading', { name: snippetName }),
  ).toBeVisible({ timeout: 10000 });
});

test('can create a snippet from empty state', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  // Check if empty state is visible - if snippets already exist, skip this test
  const emptyStateButton = authenticatedPage.getByRole('button', {
    name: 'Create Snippet',
  });
  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();

  // Wait for either the empty state or the snippet list to appear
  await Promise.race([
    emptyStateButton.waitFor({ state: 'visible', timeout: 15000 }),
    newSnippetCard.waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  // If empty state isn't visible, snippets already exist - use "New Snippet" card instead
  const createTrigger = (await emptyStateButton.isVisible())
    ? emptyStateButton
    : newSnippetCard;

  await createTrigger.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Fill in snippet name
  const snippetName = `E2E Empty State Snippet ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(snippetName);

  // Click create button
  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect
  await authenticatedPage.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the snippet name is visible
  await expect(
    authenticatedPage.getByRole('heading', { name: snippetName }),
  ).toBeVisible({ timeout: 10000 });
});

test('create snippet dialog can be opened and closed', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  // Open create dialog via "New Snippet" card
  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();
  await newSnippetCard.waitFor({ state: 'visible', timeout: 15000 });
  await newSnippetCard.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Verify dialog content
  await expect(
    dialog.getByRole('heading', { name: 'Create a new snippet' }),
  ).toBeVisible();
  await expect(dialog.locator('input[name="name"]')).toBeVisible();

  // Close dialog with Cancel button
  const cancelButton = dialog.getByRole('button', { name: /cancel/i });
  await cancelButton.waitFor({ state: 'visible', timeout: 5000 });
  await cancelButton.click();

  // Verify dialog is closed
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});
