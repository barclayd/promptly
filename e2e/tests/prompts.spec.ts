import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { z } from 'zod';
import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

const withFreshPrompt = async (
  page: Page,
  label: string,
  run: (prompt: {
    id: string;
    path: string;
    revision: string;
  }) => Promise<void>,
) => {
  const created = await page.request.post('/api/prompts/create', {
    form: { requestKey: randomUUID(), name: `${label} ${randomUUID()}` },
    maxRedirects: 0,
  });
  expect(created.status()).toBe(302);
  const path = created.headers().location;
  const id = path?.match(/^\/prompts\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (!id) throw new Error('Prompt creation did not return a document URL');
  const read = async () => {
    const response = await page.request.get(
      `/api/authoring/read?kind=prompt&id=${id}`,
    );
    expect(response.ok()).toBe(true);
    return z
      .object({ revision: z.string(), userId: z.string() })
      .parse(await response.json());
  };
  try {
    const initial = await read();
    // These tests cover the regular editor, independently of the introductory
    // tour. This preference belongs only to this test's browser context.
    await page.addInitScript((userId) => {
      localStorage.setItem(`promptly:onboarding-skipped:${userId}`, '1');
    }, initial.userId);
    await run({ id, path, revision: initial.revision });
  } finally {
    const current = await read();
    const removed = await page.request.post('/api/prompts/delete', {
      form: {
        promptId: id,
        expectedRevision: current.revision,
        requestKey: randomUUID(),
      },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
  }
};

test('can navigate to a prompt and run a test', async ({
  authenticatedPage: page,
}) => {
  await withFreshPrompt(
    page,
    'E2E Run Prompt',
    async ({ id, path, revision }) => {
      const saved = await page.request.post('/api/authoring/save', {
        form: {
          kind: 'prompt',
          id,
          expectedRevision: revision,
          requestKey: randomUUID(),
          patch: JSON.stringify({
            systemMessage: 'Return a deterministic greeting.',
            userMessage: 'Greet Acme.',
            config: {
              model: 'openai/gpt-5.5',
              temperature: 0.25,
              inputData: { customer: 'Acme' },
            },
          }),
        },
      });
      expect(saved.ok(), await saved.text()).toBe(true);
      let releaseResponse = () => {};
      const responseGate = new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });
      let captureRequest: (form: FormData) => void = () => {};
      const requestReceived = new Promise<FormData>((resolve) => {
        captureRequest = resolve;
      });
      const output = 'Hello Acme — deterministic prompt test output.';
      await page.route('**/api/prompts/run', async (route) => {
        const request = route.request();
        const form = await new Request(request.url(), {
          method: request.method(),
          headers: { 'Content-Type': request.headers()['content-type'] },
          body: request.postData(),
        }).formData();
        captureRequest(form);
        await responseGate;
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: output,
        });
      });
      try {
        await page.goto(path);
        await expect(page).toHaveURL(path);
        await expect(page.locator('#textarea-system-prompt')).toHaveValue(
          'Return a deterministic greeting.',
        );
        const testButton = page.locator('#onboarding-test-button');
        await expect(testButton).toBeEnabled();
        await testButton.click();
        await expect(testButton).toHaveText('Running...');
        await expect(testButton).toBeDisabled();
        const submitted = await requestReceived;
        expect(submitted.get('promptId')).toBe(id);
        expect(submitted.get('version')).toBe('draft');
        expect(submitted.get('model')).toBe('openai/gpt-5.5');
        expect(submitted.get('temperature')).toBe('0.25');
        expect(JSON.parse(String(submitted.get('inputData')))).toEqual({
          customer: 'Acme',
        });
        releaseResponse();
        await expect(page.locator('#onboarding-test-response')).toContainText(
          output,
        );
        await expect(testButton).toHaveText('Test');
        await expect(testButton).toBeEnabled();
      } finally {
        releaseResponse();
        await page.unrouteAll({ behavior: 'wait' });
      }
    },
  );
});

test('prompt editor has expected sections', async ({
  authenticatedPage: page,
}) => {
  await withFreshPrompt(page, 'E2E Prompt Sections', async ({ path }) => {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.getByText('System Prompt')).toBeVisible();
    await expect(page.getByText('User Prompt')).toBeVisible();
    await expect(page.locator('#onboarding-test-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Versions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Model' })).toBeVisible();
  });
});

test('can edit prompt text', async ({ authenticatedPage }) => {
  const created = await authenticatedPage.request.post('/api/prompts/create', {
    form: { requestKey: randomUUID(), name: `E2E Edit Prompt ${randomUUID()}` },
    maxRedirects: 0,
  });
  expect(created.status()).toBe(302);
  const path = created.headers().location;
  const id = path?.match(/^\/prompts\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (!id) throw new Error('Prompt creation did not return a document URL');
  const read = async () => {
    const response = await authenticatedPage.request.get(
      `/api/authoring/read?kind=prompt&id=${id}`,
    );
    expect(response.ok()).toBe(true);
    return z
      .object({
        revision: z.string(),
        definition: z.object({ systemMessage: z.string() }),
      })
      .parse(await response.json());
  };
  try {
    await authenticatedPage.goto(path);
    const textarea = authenticatedPage.locator('#textarea-system-prompt');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
    const testText = `Test input ${randomUUID()}`;
    await textarea.fill(testText);
    await expect(textarea).toHaveValue(testText);
    await expect
      .poll(async () => (await read()).definition.systemMessage)
      .toBe(testText);
    await authenticatedPage.reload();
    await expect(textarea).toHaveValue(testText);
  } finally {
    const current = await read();
    const removed = await authenticatedPage.request.post(
      '/api/prompts/delete',
      {
        form: {
          promptId: id,
          expectedRevision: current.revision,
          requestKey: randomUUID(),
        },
      },
    );
    expect(removed.ok(), await removed.text()).toBe(true);
  }
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

test('publish dialog keeps focus on minor/patch fields while typing', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto(ROUTES.home);

  const createButton = authenticatedPage.getByRole('button', {
    name: 'Create',
  });
  await createButton.click();

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const promptName = `E2E Version Focus ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(promptName);
  await dialog.getByRole('button', { name: /^create$/i }).click();

  await authenticatedPage.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, {
    timeout: 15000,
  });

  const textarea = authenticatedPage.locator('#textarea-system-prompt');
  await expect(textarea).toBeVisible();
  await textarea.fill(`Version focus test ${Date.now()}`);

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

  const minorInput = publishDialog.getByLabel('Minor version');
  const patchInput = publishDialog.getByLabel('Patch version');

  await minorInput.click();
  await expect(minorInput).toBeFocused();
  await authenticatedPage.keyboard.type('5');
  await expect(minorInput).toBeFocused();
  await expect(minorInput).toHaveValue(/5/);

  await patchInput.click();
  await expect(patchInput).toBeFocused();
  await authenticatedPage.keyboard.type('7');
  await expect(patchInput).toBeFocused();
  await expect(patchInput).toHaveValue(/7/);
});
