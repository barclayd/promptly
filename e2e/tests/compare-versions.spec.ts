import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('compare versions page: CTA, cards, chip toggling and view modes', async ({
  authenticatedPage,
}) => {
  // Create a fresh prompt so the test owns its version history
  await authenticatedPage.goto(ROUTES.home);

  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const promptName = `E2E Compare Test ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(promptName);
  await dialog.getByRole('button', { name: /^create$/i }).click();

  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Add content and publish v1 so a published baseline exists
  const textarea = authenticatedPage.locator('#textarea-system-prompt');
  await expect(textarea).toBeVisible();
  await textarea.fill('You are a helpful assistant. Reply briefly.');

  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  const publishButton = authenticatedPage.getByRole('button', {
    name: /publish/i,
  });
  await expect(publishButton).toBeEnabled({ timeout: 10000 });
  await publishButton.click();

  const publishDialog = authenticatedPage.getByRole('dialog');
  await expect(publishDialog).toBeVisible();
  await publishDialog.getByRole('button', { name: /publish/i }).click();
  await expect(publishDialog).not.toBeVisible({ timeout: 10000 });

  // Edit again so a new draft is created alongside the published version
  await textarea.fill(
    'You are a helpful and concise assistant. Reply briefly and kindly.',
  );
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  // Reload so the versions panel reflects both versions
  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');

  // The Compare versions CTA appears under the versions table
  const compareCta = authenticatedPage.getByTestId('compare-versions-cta');
  await expect(compareCta).toBeVisible({ timeout: 10000 });
  await compareCta.click();

  // Lands on the compare page
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+\/compare$/, {
    timeout: 15000,
  });
  await expect(
    authenticatedPage.getByRole('heading', { name: 'Compare versions' }),
  ).toBeVisible();

  // Both versions render as cards (published baseline + draft)
  const cards = authenticatedPage.getByTestId('compare-version-card');
  await expect(cards).toHaveCount(2);

  // The baseline card is pinned and tagged
  await expect(authenticatedPage.getByText('Baseline')).toBeVisible();

  // Toggling the draft chip removes its card, toggling again restores it
  const draftChip = authenticatedPage.getByTestId('compare-chip-draft');
  await expect(draftChip).toBeVisible();
  await draftChip.click();
  await expect(cards).toHaveCount(1);
  await draftChip.click();
  await expect(cards).toHaveCount(2);

  // Diff / Full text view modes switch
  const fullTextTab = authenticatedPage.getByRole('tab', {
    name: 'Full text',
  });
  await fullTextTab.click();
  await expect(fullTextTab).toHaveAttribute('data-state', 'active');
  const diffTab = authenticatedPage.getByRole('tab', { name: 'Diff' });
  await diffTab.click();
  await expect(diffTab).toHaveAttribute('data-state', 'active');

  // Generate CTA is present (not clicked — it triggers real LLM runs)
  await expect(authenticatedPage.getByTestId('compare-generate')).toBeVisible();

  // Test input section collapses
  const inputToggle = authenticatedPage.getByTestId('compare-input-toggle');
  await inputToggle.click();
  await expect(
    authenticatedPage.getByText('Temperature', { exact: true }),
  ).not.toBeVisible();

  // Back button returns to the prompt editor
  await authenticatedPage
    .getByRole('link', { name: /back to editor/i })
    .click();
  await expect(authenticatedPage).toHaveURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });
});

test('compare cards: long sections scroll internally and stay in sync', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.setViewportSize({ width: 1280, height: 900 });

  // Create a fresh prompt so the test owns its version history
  await authenticatedPage.goto(ROUTES.home);
  await authenticatedPage.getByRole('button', { name: 'Create' }).click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const promptName = `E2E Compare Overflow ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(promptName);
  await dialog.getByRole('button', { name: /^create$/i }).click();
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // A system prompt far taller than any card so the section must overflow
  const longSystemPrompt = Array.from(
    { length: 60 },
    (_, i) =>
      `Rule ${i + 1}: respond helpfully and follow instruction ${i + 1}.`,
  ).join('\n');

  const textarea = authenticatedPage.locator('#textarea-system-prompt');
  await expect(textarea).toBeVisible();
  await textarea.fill(longSystemPrompt);
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  // Publish v1 so a published baseline exists
  const publishButton = authenticatedPage.getByRole('button', {
    name: /publish/i,
  });
  await expect(publishButton).toBeEnabled({ timeout: 10000 });
  await publishButton.click();
  const publishDialog = authenticatedPage.getByRole('dialog');
  await expect(publishDialog).toBeVisible();
  await publishDialog.getByRole('button', { name: /publish/i }).click();
  await expect(publishDialog).not.toBeVisible({ timeout: 10000 });

  // Edit again so a draft exists alongside the published version
  await textarea.fill(`${longSystemPrompt}\nRule 61: always be concise.`);
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);
  await expect(authenticatedPage.getByText(/^Saved/).first()).toBeVisible({
    timeout: 10000,
  });

  await authenticatedPage.reload();
  await authenticatedPage.waitForLoadState('networkidle');
  await authenticatedPage.getByTestId('compare-versions-cta').click();
  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+\/compare$/, {
    timeout: 15000,
  });

  const cards = authenticatedPage.getByTestId('compare-version-card');
  await expect(cards).toHaveCount(2);

  // The long system prompt overflows its section and scrolls internally
  const firstSystem = cards.first().locator('[data-cv-scroll="system"]');
  await expect
    .poll(
      () => firstSystem.evaluate((el) => el.scrollHeight - el.clientHeight),
      { timeout: 10000 },
    )
    .toBeGreaterThan(100);

  // The overflow affordance (bottom fade) is armed
  await expect(firstSystem).toHaveAttribute('data-overflowing', 'true');
  await expect(firstSystem).toHaveAttribute('data-at-bottom', 'false');

  // Output stays on screen without scrolling the card body
  await expect(
    cards.first().locator('[data-cv-block="output"]'),
  ).toBeInViewport();
  await expect(
    cards.nth(1).locator('[data-cv-block="output"]'),
  ).toBeInViewport();

  // Scrolling one card's system prompt scrolls the other card's in sync
  await firstSystem.evaluate((el) => {
    el.scrollTop = 150;
  });
  const secondSystem = cards.nth(1).locator('[data-cv-scroll="system"]');
  await expect
    .poll(() => secondSystem.evaluate((el) => el.scrollTop), {
      timeout: 5000,
    })
    .toBeGreaterThan(100);
});
