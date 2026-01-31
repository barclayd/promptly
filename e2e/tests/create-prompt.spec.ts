import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can create a new prompt via sidebar button', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.home);

  // Click "Create" button in sidebar
  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await expect(createButton).toBeVisible();
  await createButton.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Fill in prompt name with unique identifier
  const promptName = `E2E Test Prompt ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(promptName);

  // Optionally fill description
  const descriptionInput = dialog.locator('textarea[name="description"]');
  if (await descriptionInput.isVisible()) {
    await descriptionInput.fill('Created by E2E test');
  }

  // Click create button in dialog
  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.click();

  // Wait for navigation to new prompt page
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify the prompt name is visible on the page (in the header)
  await expect(
    authenticatedPage.getByRole('heading', { name: promptName }),
  ).toBeVisible();
});

test('can create a new prompt via prompts page card', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.prompts);
  await expect(authenticatedPage).toHaveURL(ROUTES.prompts);

  // Wait for the Suspense/Await to resolve - either prompts load or "New Prompt" card appears
  // Use getByRole('button') with .first() to handle any potential duplicates during loading
  const newPromptCard = authenticatedPage
    .getByRole('button', { name: 'New Prompt' })
    .first();
  await newPromptCard.waitFor({ state: 'visible', timeout: 10000 });

  // Click the card to open the create dialog
  await newPromptCard.click();

  // Verify dialog opens
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Fill in prompt name
  const promptName = `E2E Card Prompt ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(promptName);

  // Click create button
  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.click();

  // Wait for redirect
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify the prompt name is visible
  await expect(
    authenticatedPage.getByRole('heading', { name: promptName }),
  ).toBeVisible();
});

test('create dialog can be opened and closed', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.home);

  // Open create dialog
  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Verify dialog content
  await expect(
    dialog.getByRole('heading', { name: 'Create a new prompt' }),
  ).toBeVisible();
  await expect(dialog.locator('input[name="name"]')).toBeVisible();

  // Close dialog with Cancel button
  const cancelButton = dialog.getByRole('button', { name: /cancel/i });
  await cancelButton.click();

  // Verify dialog is closed
  await expect(dialog).not.toBeVisible();
});
