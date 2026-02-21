import { expect, test } from '../fixtures/base';
import { ROUTES } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

test('can navigate to a snippet and see editor', async ({
  authenticatedPage,
}) => {
  // Navigate to snippets page
  await authenticatedPage.goto(ROUTES.snippets);
  await authenticatedPage.waitForLoadState('networkidle');
  await expect(authenticatedPage).toHaveURL(ROUTES.snippets);

  // Wait for snippet list to load and click on the first snippet
  const firstSnippetLink = authenticatedPage
    .locator('a[href^="/snippets/"]')
    .first();
  await firstSnippetLink.waitFor({ state: 'visible', timeout: 15000 });
  await firstSnippetLink.click();

  // Verify URL changed to a specific snippet
  await expect(authenticatedPage).toHaveURL(/\/snippets\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  // Verify "System Prompt Snippet" editor title is visible
  await expect(
    authenticatedPage.getByText('System Prompt Snippet'),
  ).toBeVisible();

  // Verify sidebar sections exist (use data-sidebar attribute to target collapsible labels)
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Versions',
    }),
  ).toBeVisible();
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Used by',
    }),
  ).toBeVisible();
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Test',
    }),
  ).toBeVisible();
});

test('snippet editor has expected sections', async ({ authenticatedPage }) => {
  // Navigate to a snippet
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

  // Verify heading exists
  const h1 = authenticatedPage.locator('h1');
  await expect(h1).toBeVisible();

  // Verify "System Prompt Snippet" label
  await expect(
    authenticatedPage.getByText('System Prompt Snippet'),
  ).toBeVisible();

  // Verify sidebar sections exist (use data-sidebar attribute to target collapsible labels)
  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Test',
    }),
  ).toBeVisible();

  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Versions',
    }),
  ).toBeVisible();

  await expect(
    authenticatedPage.locator('[data-sidebar="group-label"]', {
      hasText: 'Used by',
    }),
  ).toBeVisible();
});

test('can edit snippet content', async ({ authenticatedPage }) => {
  // Navigate to a snippet
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

  // Find the System Prompt textarea
  const textarea = authenticatedPage.locator('#textarea-system-prompt-snippet');
  await expect(textarea).toBeVisible();

  // Clear existing content and enter test text
  const testText = `Test snippet input ${Date.now()}`;
  await textarea.fill(testText);

  // Verify the text was entered
  await expect(textarea).toHaveValue(testText);
});
