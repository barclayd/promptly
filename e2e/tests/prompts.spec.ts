import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can navigate to a prompt and run a test', async ({
  authenticatedPage,
}) => {
  // Navigate to prompts page
  await authenticatedPage.goto(ROUTES.prompts);
  await authenticatedPage.waitForLoadState('networkidle');
  await expect(authenticatedPage).toHaveURL(ROUTES.prompts);

  // Wait for prompt list to load and click on the first prompt
  const firstPromptLink = authenticatedPage
    .locator('a[href^="/prompts/"]')
    .first();
  await firstPromptLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstPromptLink.click();

  // Verify URL changed to a specific prompt
  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Click "Test" button - it's a button with variant="default" containing "Test" text
  const testButton = authenticatedPage
    .locator('[data-slot="button"][data-variant="default"]')
    .filter({ hasText: 'Test' })
    .first();
  await expect(testButton).toBeVisible();
  await testButton.click();

  // Wait for button to show "Running..." state
  await expect(
    authenticatedPage
      .locator('[data-slot="button"]')
      .filter({ hasText: 'Running...' }),
  ).toBeVisible({ timeout: TIMEOUTS.navigation });

  // Wait for response to complete (button returns to "Test")
  await expect(testButton).toBeVisible({ timeout: TIMEOUTS.streaming });
  await expect(testButton).toContainText('Test');
});

test('prompt editor has expected sections', async ({ authenticatedPage }) => {
  // Navigate to a prompt
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

  // Verify System Prompt section exists
  await expect(authenticatedPage.getByText('System Prompt')).toBeVisible();

  // Verify User Prompt section exists
  await expect(authenticatedPage.getByText('User Prompt')).toBeVisible();

  // Verify the Test button exists in the input groups
  const testButtons = authenticatedPage
    .locator('[data-slot="button"]')
    .filter({ hasText: 'Test' });
  await expect(testButtons.first()).toBeVisible();

  // Verify sidebar sections exist (on the right)
  await expect(
    authenticatedPage.getByRole('button', { name: 'Versions' }),
  ).toBeVisible();
  await expect(
    authenticatedPage.getByRole('button', { name: 'Model' }),
  ).toBeVisible();
});

test('can edit prompt text', async ({ authenticatedPage }) => {
  // Navigate to a prompt
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

  // Find the System Prompt textarea
  const textarea = authenticatedPage.locator('#textarea-system-prompt');
  await expect(textarea).toBeVisible();

  // Clear existing content and enter test text
  const testText = `Test input ${Date.now()}`;
  await textarea.fill(testText);

  // Verify the text was entered
  await expect(textarea).toHaveValue(testText);
});

test('can publish a version and view it in read-only mode', async ({
  authenticatedPage,
}) => {
  // Create a fresh prompt for this test to avoid state from previous runs
  await authenticatedPage.goto(ROUTES.home);

  // Click "Create" button in sidebar
  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.click();

  // Fill in the create dialog
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const promptName = `E2E Publish Test ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(promptName);

  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.click();

  // Wait for redirect to new prompt
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Add content to the System Prompt
  const textarea = authenticatedPage.locator('#textarea-system-prompt');
  await expect(textarea).toBeVisible();

  const systemContent = `This is a test prompt created at ${Date.now()}`;
  await textarea.fill(systemContent);

  // Wait for auto-save to complete
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Wait for the "Saved" indicator (use .first() since both system and user prompts show save status)
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  // The publish button should now be enabled (new prompt with content)
  const publishButton = authenticatedPage.getByRole('button', {
    name: /publish/i,
  });
  await expect(publishButton).toBeEnabled({ timeout: 10000 });
  await publishButton.click();

  // Verify publish dialog opens
  const publishDialog = authenticatedPage.getByRole('dialog');
  await expect(publishDialog).toBeVisible();

  // Get the version from the hidden input
  const versionHiddenInput = publishDialog.locator('input[name="version"]');
  const suggestedVersion = await versionHiddenInput.inputValue();

  // Click the Publish button in the dialog
  const dialogPublishButton = publishDialog.getByRole('button', {
    name: /publish/i,
  });
  await dialogPublishButton.click();

  // Wait for dialog to close (indicates success)
  await expect(publishDialog).not.toBeVisible({ timeout: 10000 });

  // Now verify we can view the published version
  // Look for versions section - expand it if collapsed
  const versionsSection = authenticatedPage.getByRole('button', {
    name: /versions/i,
  });

  if (await versionsSection.isVisible()) {
    const isExpanded = await versionsSection.getAttribute('data-state');
    if (isExpanded === 'closed') {
      await versionsSection.click();
    }
  }

  // Wait for the versions table to show the published version
  const versionCell = authenticatedPage.getByRole('cell', {
    name: suggestedVersion,
  });
  await expect(versionCell).toBeVisible({ timeout: 5000 });

  // Click on the version row to view it
  const versionRow = authenticatedPage
    .locator('tr')
    .filter({ has: versionCell });
  await versionRow.click();

  // Verify URL has version query param
  await expect(authenticatedPage).toHaveURL(/\?version=/);

  // Verify the version banner is visible (indicates read-only mode)
  const versionBanner = authenticatedPage.getByText(
    /viewing version.*read-only/i,
  );
  await expect(versionBanner).toBeVisible();

  // Verify textarea is disabled when viewing old version
  await expect(textarea).toBeDisabled();

  // Click "Back to latest" to return to draft
  const backButton = authenticatedPage.getByRole('button', {
    name: /back to latest/i,
  });
  await backButton.click();

  // Verify we're back to the draft (no version param, textarea enabled)
  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/);
  await expect(textarea).toBeEnabled();
});
