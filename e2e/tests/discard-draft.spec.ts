import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('discard draft reverts a prompt to its published version', async ({
  authenticatedPage: page,
}) => {
  await page.goto(ROUTES.prompts);
  await page
    .getByRole('button', { name: 'Create', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('input[name="name"]')
    .fill(`E2E Discard Prompt ${Date.now()}`);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/);

  const fileMenu = page.getByRole('menubar').getByText('File');
  const discardItem = page.getByRole('menuitem', { name: 'Discard draft' });
  const system = page.locator('#textarea-system-prompt');

  // Never published: nothing to revert to.
  await system.fill('Published baseline');
  await fileMenu.click();
  await expect(discardItem).toBeDisabled();
  await page.keyboard.press('Escape');

  await page
    .getByRole('button', { name: 'Publish', exact: true })
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await system.fill('Draft edit to throw away');
  await fileMenu.click();
  await discardItem.click();
  await expect(dialog.getByText('v1.0.0')).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard draft' }).click();
  await expect(dialog).not.toBeVisible();

  await expect(system).toHaveValue('Published baseline');
  await page.reload();
  await expect(system).toHaveValue('Published baseline');
  await fileMenu.click();
  await expect(discardItem).toBeDisabled();
});

test('discard draft reverts a snippet to its published version', async ({
  authenticatedPage: page,
}) => {
  await page.goto(ROUTES.snippets);
  await page.getByRole('button', { name: 'New Snippet' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('input[name="name"]')
    .fill(`E2E Discard Snippet ${Date.now()}`);
  await dialog.getByRole('button', { name: /^create$/i }).click();
  await page.waitForURL(/\/snippets\/[a-zA-Z0-9_-]+$/);

  const textarea = page.locator('#textarea-system-prompt-snippet');
  await textarea.fill('Published baseline');
  await page.waitForTimeout(TIMEOUTS.autoSave);
  await page.getByRole('button', { name: /publish/i }).click();
  await dialog.getByRole('button', { name: /publish/i }).click();
  await expect(dialog).not.toBeVisible();

  await textarea.fill('Draft edit to throw away');
  await page.waitForTimeout(TIMEOUTS.autoSave);
  await page.getByRole('menubar').getByText('File').click();
  const discardItem = page.getByRole('menuitem', { name: 'Discard draft' });
  await expect(discardItem).toBeEnabled();
  await discardItem.click();
  await dialog.getByRole('button', { name: 'Discard draft' }).click();
  await expect(dialog).not.toBeVisible();

  await expect(textarea).toHaveValue('Published baseline');
  await page.reload();
  await expect(textarea).toHaveValue('Published baseline');
});
