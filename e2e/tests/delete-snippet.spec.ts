import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

const withFreshSnippet = async (
  page: Page,
  label: string,
  run: (snippet: { id: string; name: string; path: string }) => Promise<void>,
) => {
  const name = `${label} ${randomUUID()}`;
  const created = await page.request.post('/api/snippets/create', {
    form: { name },
    maxRedirects: 0,
  });
  expect(created.status()).toBe(302);
  const path = created.headers().location;
  const id = path?.match(/^\/snippets\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (!id) throw new Error('Snippet creation did not return a document URL');
  try {
    await page.goto(path);
    await expect(page.locator('h1')).toContainText(name);
    await run({ id, name, path });
  } finally {
    const removed = await page.request.post('/api/snippets/delete', {
      form: { snippetId: id },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
  }
};

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
  await withFreshSnippet(
    authenticatedPage,
    'E2E Cancel Snippet',
    async ({ name, path }) => {
      await authenticatedPage.getByRole('menubar').getByText('File').click();
      await authenticatedPage.getByRole('menuitem', { name: 'Delete' }).click();
      const deleteDialog = authenticatedPage.getByRole('dialog');
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(authenticatedPage).toHaveURL(path);
      await expect(authenticatedPage.locator('h1')).toContainText(name);
      await authenticatedPage.reload();
      await expect(authenticatedPage.locator('h1')).toContainText(name);
    },
  );
});

test('copy snippet ID via File > Share menu copies ID to clipboard', async ({
  authenticatedPage,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await withFreshSnippet(
    authenticatedPage,
    'E2E Copy Snippet',
    async ({ id }) => {
      await authenticatedPage.getByRole('menubar').getByText('File').click();
      await authenticatedPage.getByRole('menuitem', { name: 'Share' }).click();
      const copyItem = authenticatedPage.getByRole('menuitem', {
        name: 'Copy Snippet ID',
      });
      await expect(copyItem).toBeVisible();
      await copyItem.click();
      await expect(
        authenticatedPage.getByText('Snippet ID copied to clipboard'),
      ).toBeVisible({ timeout: 5000 });
      expect(
        await authenticatedPage.evaluate(() => navigator.clipboard.readText()),
      ).toBe(id);
    },
  );
});

test('delete dialog shows warning about prompts referencing snippet', async ({
  authenticatedPage,
}) => {
  await withFreshSnippet(authenticatedPage, 'E2E Snippet Warning', async () => {
    await authenticatedPage.getByRole('menubar').getByText('File').click();
    await authenticatedPage.getByRole('menuitem', { name: 'Delete' }).click();
    const deleteDialog = authenticatedPage.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('Delete snippet')).toBeVisible();
    await expect(deleteDialog.getByText(/cannot be undone/i)).toBeVisible();
    await expect(
      deleteDialog.getByText(
        /Prompts referencing this snippet will no longer resolve/i,
      ),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(deleteDialog).not.toBeVisible();
  });
});
