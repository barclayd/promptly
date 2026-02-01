import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can create a new prompt via sidebar button', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.waitForLoadState('networkidle');

  // Click "Create" button in sidebar
  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Fill in prompt name with unique identifier
  const promptName = `E2E Test Prompt ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(promptName);

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

  // Wait for navigation to new prompt page
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the prompt name is visible on the page (in the header)
  await expect(
    authenticatedPage.getByRole('heading', { name: promptName }),
  ).toBeVisible({ timeout: 10000 });
});

test('can create a new prompt via prompts page card', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.prompts);
  await authenticatedPage.waitForLoadState('networkidle');
  await expect(authenticatedPage).toHaveURL(ROUTES.prompts);

  // Wait for the Suspense/Await to resolve - either prompts load or "New Prompt" card appears
  // Use getByRole('button') with .first() to handle any potential duplicates during loading
  const newPromptCard = authenticatedPage
    .getByRole('button', { name: 'New Prompt' })
    .first();
  await newPromptCard.waitFor({ state: 'visible', timeout: 15000 });

  // Click the card to open the create dialog
  await newPromptCard.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Fill in prompt name
  const promptName = `E2E Card Prompt ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(promptName);

  // Click create button
  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();

  // Wait for dialog to close (indicates form submission completed)
  await expect(dialog).not.toBeVisible({ timeout: 30000 });

  // Wait for redirect
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 30000,
  });

  // Wait for page to fully load after navigation
  await authenticatedPage.waitForLoadState('networkidle');

  // Verify the prompt name is visible
  await expect(
    authenticatedPage.getByRole('heading', { name: promptName }),
  ).toBeVisible({ timeout: 10000 });
});

test('create dialog can be opened and closed', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.waitForLoadState('networkidle');

  // Open create dialog
  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Verify dialog content
  await expect(
    dialog.getByRole('heading', { name: 'Create a new prompt' }),
  ).toBeVisible();
  await expect(dialog.locator('input[name="name"]')).toBeVisible();

  // Close dialog with Cancel button
  const cancelButton = dialog.getByRole('button', { name: /cancel/i });
  await cancelButton.waitFor({ state: 'visible', timeout: 5000 });
  await cancelButton.click();

  // Verify dialog is closed
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});
