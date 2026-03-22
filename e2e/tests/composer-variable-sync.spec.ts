import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/base';
import { ROUTES, TIMEOUTS } from '../helpers/test-data';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.
// See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

// --- Test data ---
// "Welcome Scott" prompt in the test user's org has two string variables: first_name, time_of_day
const PROMPT_WITH_VARS = {
  id: 'W1sLHT5_usBpInYKDCUjl',
  name: 'Welcome Scott',
  variables: ['first_name', 'time_of_day'],
};

// A prompt with no schema variables (empty config)
const PROMPT_WITHOUT_VARS = {
  id: 'Pg-iWCJqo09cuOTbqliEo',
  name: 'Test URL Structure',
};

// --- Helpers ---

/**
 * Creates a fresh composer and navigates to its detail page.
 */
const createFreshComposer = async (page: Page) => {
  await page.goto(ROUTES.composers);
  await page.waitForLoadState('networkidle');

  const createButton = page
    .getByRole('button', { name: /create composer|new composer/i })
    .first();
  await createButton.waitFor({ state: 'visible', timeout: 15000 });
  await createButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  const nameInput = dialog.locator('input[name="name"]');
  await nameInput.fill(`Test Composer ${Date.now()}`);

  const submitButton = dialog.getByRole('button', { name: /create/i });
  await submitButton.click();

  await page.waitForURL(/\/composers\/[a-zA-Z0-9_-]+$/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  // The editor is lazy-loaded inside Suspense — wait generously
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
};

/**
 * Inserts a prompt ref badge into the TipTap editor and triggers the onPromptAdded
 * callback via React fiber tree traversal to open the variable import modal.
 */
const insertPromptAndTriggerModal = async (
  page: Page,
  promptId: string,
  promptName: string,
) => {
  await page.evaluate(
    ({ promptId, promptName }) => {
      const editorEl = document.querySelector('.ProseMirror') as HTMLElement & {
        editor?: {
          chain: () => {
            focus: () => {
              insertPromptRef: (attrs: {
                promptId: string;
                promptName: string;
              }) => { run: () => void };
            };
          };
        };
      };
      if (!editorEl?.editor) throw new Error('Editor not found');
      editorEl.editor
        .chain()
        .focus()
        .insertPromptRef({ promptId, promptName })
        .run();
    },
    { promptId, promptName },
  );

  // Trigger onPromptAdded via React fiber tree
  await page.evaluate(
    ({ promptId, promptName }) => {
      const root = document.body.children[0];
      const fiberKey = Object.keys(root).find((k) =>
        k.startsWith('__reactFiber'),
      );
      if (!fiberKey) throw new Error('React fiber not found');

      type Fiber = {
        memoizedProps?: { onPromptAdded?: (id: string, name: string) => void };
        child?: Fiber;
        sibling?: Fiber;
      };

      const fiber: Fiber | undefined = (
        root as unknown as Record<string, Fiber>
      )[fiberKey];
      const queue: Fiber[] = [fiber];
      const visited = new Set<Fiber>();

      while (queue.length > 0 && visited.size < 10000) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        if (current.memoizedProps?.onPromptAdded) {
          current.memoizedProps.onPromptAdded(promptId, promptName);
          return;
        }
        if (current.child) queue.push(current.child);
        if (current.sibling) queue.push(current.sibling);
      }
      throw new Error('onPromptAdded callback not found in fiber tree');
    },
    { promptId, promptName },
  );
};

/**
 * Deletes all prompt ref nodes for a given promptId from the TipTap editor.
 */
const deleteAllPromptRefs = async (page: Page, promptId: string) => {
  await page.evaluate((pid) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const editorEl = document.querySelector('.ProseMirror') as any;
    if (!editorEl?.editor) throw new Error('Editor not found');

    const editor = editorEl.editor;
    const positions: number[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'promptRef' && node.attrs.promptId === pid) {
        positions.push(pos);
      }
    });

    // Delete from end to start so positions don't shift
    positions.reverse();
    for (const pos of positions) {
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
        editor.view.dispatch(tr);
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, promptId);
};

/**
 * Expands the Schema Builder sidebar section and returns all field names.
 */
const getSchemaFieldNames = async (page: Page): Promise<string[]> => {
  const schemaButton = page.getByRole('button', { name: /schema builder/i });
  await schemaButton.waitFor({ state: 'visible', timeout: 5000 });

  const isExpanded = await schemaButton.getAttribute('aria-expanded');
  if (isExpanded !== 'true') {
    await schemaButton.click();
    await page.waitForTimeout(300);
  }

  const allInputs = page.locator('input');
  const count = await allInputs.count();
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    const input = allInputs.nth(i);
    const value = await input.inputValue();
    // Schema builder field name inputs have actual variable names as values
    if (
      value &&
      !value.includes('Draft') &&
      !value.includes('Test Composer') &&
      (await input.isVisible())
    ) {
      // Check if this input is inside the schema builder area
      const isInSchemaArea = await input.evaluate((el) => {
        let parent = el.parentElement;
        while (parent) {
          if (parent.textContent?.includes('Field Name')) return true;
          parent = parent.parentElement;
        }
        return false;
      });
      if (isInSchemaArea) {
        names.push(value);
      }
    }
  }
  return names;
};

// --- Tests ---

test('adding a prompt with variables shows import modal', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog).toContainText('Import variables from Welcome Scott');
  await expect(dialog.getByText('first_name')).toBeVisible();
  await expect(dialog.getByText('time_of_day')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /add selected/i }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: /skip/i })).toBeVisible();

  // Dismiss
  await dialog.getByRole('button', { name: /skip/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});

test('import modal adds selected variables to schema builder', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Click Add Selected
  await dialog.getByRole('button', { name: /add selected/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  // Wait for auto-save to process schema changes
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Verify variables appear in Schema Builder
  const fieldNames = await getSchemaFieldNames(authenticatedPage);
  expect(fieldNames).toContain('first_name');
  expect(fieldNames).toContain('time_of_day');
});

test('skip button dismisses modal without adding variables', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Click Skip
  await dialog.getByRole('button', { name: /skip/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  // Schema Builder should be empty
  const fieldNames = await getSchemaFieldNames(authenticatedPage);
  expect(fieldNames).toHaveLength(0);
});

test('removing a prompt shows cleanup modal with orphaned variables', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  // Insert prompt and add variables
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const addDialog = authenticatedPage.getByRole('dialog');
  await expect(addDialog).toBeVisible({ timeout: 10000 });
  await addDialog.getByRole('button', { name: /add selected/i }).click();
  await expect(addDialog).not.toBeVisible({ timeout: 5000 });

  // Wait for schema to save
  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Delete the prompt ref — this should trigger the cleanup modal
  await deleteAllPromptRefs(authenticatedPage, PROMPT_WITH_VARS.id);

  const cleanupDialog = authenticatedPage.getByRole('dialog');
  await expect(cleanupDialog).toBeVisible({ timeout: 10000 });
  await expect(cleanupDialog).toContainText('Clean up variables');
  await expect(cleanupDialog.getByText('first_name')).toBeVisible();
  await expect(cleanupDialog.getByText('time_of_day')).toBeVisible();
  await expect(
    cleanupDialog.getByRole('button', { name: /remove selected/i }),
  ).toBeVisible();

  // Dismiss
  await cleanupDialog.getByRole('button', { name: /keep all/i }).click();
  await expect(cleanupDialog).not.toBeVisible({ timeout: 5000 });
});

test('cleanup modal removes selected variables from schema', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  // Insert prompt and add variables
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const addDialog = authenticatedPage.getByRole('dialog');
  await expect(addDialog).toBeVisible({ timeout: 10000 });
  await addDialog.getByRole('button', { name: /add selected/i }).click();
  await expect(addDialog).not.toBeVisible({ timeout: 5000 });

  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Delete prompt ref
  await deleteAllPromptRefs(authenticatedPage, PROMPT_WITH_VARS.id);

  const cleanupDialog = authenticatedPage.getByRole('dialog');
  await expect(cleanupDialog).toBeVisible({ timeout: 10000 });

  // Remove selected variables
  await cleanupDialog.getByRole('button', { name: /remove selected/i }).click();
  await expect(cleanupDialog).not.toBeVisible({ timeout: 5000 });

  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Schema should be empty
  const fieldNames = await getSchemaFieldNames(authenticatedPage);
  expect(fieldNames).toHaveLength(0);
});

test('keep all button preserves variables after prompt removal', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  // Insert prompt and add variables
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const addDialog = authenticatedPage.getByRole('dialog');
  await expect(addDialog).toBeVisible({ timeout: 10000 });
  await addDialog.getByRole('button', { name: /add selected/i }).click();
  await expect(addDialog).not.toBeVisible({ timeout: 5000 });

  await authenticatedPage.waitForTimeout(TIMEOUTS.autoSave);

  // Delete prompt ref
  await deleteAllPromptRefs(authenticatedPage, PROMPT_WITH_VARS.id);

  const cleanupDialog = authenticatedPage.getByRole('dialog');
  await expect(cleanupDialog).toBeVisible({ timeout: 10000 });

  // Keep all
  await cleanupDialog.getByRole('button', { name: /keep all/i }).click();
  await expect(cleanupDialog).not.toBeVisible({ timeout: 5000 });

  // Variables should still be in schema
  const fieldNames = await getSchemaFieldNames(authenticatedPage);
  expect(fieldNames).toContain('first_name');
  expect(fieldNames).toContain('time_of_day');
});

test('duplicate prompt insertion skips the import modal', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  // First insertion — shows modal, dismiss it
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  const dialog = authenticatedPage.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole('button', { name: /skip/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  // Second insertion of same prompt — should skip modal
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITH_VARS.id,
    PROMPT_WITH_VARS.name,
  );

  // Wait briefly and verify no dialog appears
  await authenticatedPage.waitForTimeout(2000);
  await expect(authenticatedPage.getByRole('dialog')).not.toBeVisible();
});

test('adding prompt with no variables skips modal', async ({
  authenticatedPage,
}) => {
  await createFreshComposer(authenticatedPage);

  // Insert a prompt that has no schema variables
  await insertPromptAndTriggerModal(
    authenticatedPage,
    PROMPT_WITHOUT_VARS.id,
    PROMPT_WITHOUT_VARS.name,
  );

  // Wait briefly and verify no dialog appears
  await authenticatedPage.waitForTimeout(2000);
  await expect(authenticatedPage.getByRole('dialog')).not.toBeVisible();
});
