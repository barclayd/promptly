import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can publish a version and view it in read-only mode', async ({
  authenticatedPage,
}) => {
  // Create a fresh snippet for this test to avoid state from previous runs
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();
  await newSnippetCard.waitFor({ state: 'visible', timeout: 15000 });
  await newSnippetCard.click();

  // Fill in the create dialog
  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const snippetName = `E2E Publish Snippet ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(snippetName);

  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.click();

  // Wait for redirect to new snippet
  await authenticatedPage.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Add content to the System Prompt
  const textarea = authenticatedPage.locator('#textarea-system-prompt-snippet');
  await expect(textarea).toBeVisible();

  const systemContent = `This is a test snippet created at ${Date.now()}`;
  await textarea.fill(systemContent);

  // Wait for auto-save to complete
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Wait for the "Saved" indicator
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  // The publish button should now be enabled (new snippet with content)
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
  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/);
  await expect(textarea).toBeEnabled();
});
