import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can edit snippet name and description via Edit menu', async ({
  authenticatedPage,
}) => {
  // Create a fresh snippet for this test
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');

  const newSnippetCard = authenticatedPage
    .getByRole('button', { name: 'New Snippet' })
    .first();
  await newSnippetCard.waitFor({ state: 'visible', timeout: 15000 });
  await newSnippetCard.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const originalName = `E2E Edit Snippet ${Date.now()}`;
  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(originalName);

  const submitButton = dialog.getByRole('button', { name: /^create$/i });
  await submitButton.click();

  // Wait for redirect to new snippet
  await authenticatedPage.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify the snippet name is displayed
  await expect(authenticatedPage.locator('h1')).toContainText(originalName);

  // Open Edit menu and click "Edit Details..."
  const editMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('Edit');
  await editMenuTrigger.click();

  const editDetailsItem = authenticatedPage.getByRole('menuitem', {
    name: 'Edit Details...',
  });
  await editDetailsItem.click();

  // Verify dialog opens with current values
  const editDialog = authenticatedPage.getByRole('dialog');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.locator('input[name="name"]')).toHaveValue(
    originalName,
  );

  // Update the name and description
  const newName = `Updated Snippet ${Date.now()}`;
  const newDescription = 'This is a test snippet description';

  await editDialog.locator('input[name="name"]').fill(newName);
  await editDialog.locator('textarea[name="description"]').fill(newDescription);

  // Click Save
  const saveButton = editDialog.getByRole('button', { name: 'Save' });
  await saveButton.click();

  // Wait for dialog to close
  await expect(editDialog).not.toBeVisible({ timeout: 10000 });

  // Verify the page updated with new values
  await expect(authenticatedPage.locator('h1')).toContainText(newName);
  await expect(
    authenticatedPage.locator('p.text-secondary-foreground'),
  ).toContainText(newDescription);
});

test('cancel button preserves original values', async ({
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

  // Get the current snippet name
  const originalName = await authenticatedPage.locator('h1').textContent();

  // Open Edit menu and click "Edit Details..."
  const editMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('Edit');
  await editMenuTrigger.click();

  const editDetailsItem = authenticatedPage.getByRole('menuitem', {
    name: 'Edit Details...',
  });
  await editDetailsItem.click();

  // Verify dialog opens
  const editDialog = authenticatedPage.getByRole('dialog');
  await expect(editDialog).toBeVisible();

  // Modify the name but don't save
  await editDialog.locator('input[name="name"]').fill('Modified Snippet Name');

  // Click Cancel
  const cancelButton = editDialog.getByRole('button', { name: 'Cancel' });
  await cancelButton.click();

  // Wait for dialog to close
  await expect(editDialog).not.toBeVisible();

  // Verify the page still shows original name
  await expect(authenticatedPage.locator('h1')).toContainText(
    originalName ?? '',
  );
});

test('validation prevents saving with empty name', async ({
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

  // Open Edit menu and click "Edit Details..."
  const editMenuTrigger = authenticatedPage
    .getByRole('menubar')
    .getByText('Edit');
  await editMenuTrigger.click();

  const editDetailsItem = authenticatedPage.getByRole('menuitem', {
    name: 'Edit Details...',
  });
  await editDetailsItem.click();

  // Verify dialog opens
  const editDialog = authenticatedPage.getByRole('dialog');
  await expect(editDialog).toBeVisible();

  // Clear the name field
  await editDialog.locator('input[name="name"]').fill('');

  // Verify Save button is disabled when name is empty
  const saveButton = editDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeDisabled();
});
