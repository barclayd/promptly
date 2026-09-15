import { randomUUID } from 'node:crypto';
import type { BrowserAuthoringDocument } from '../../app/lib/authoring/browser-types';
import { expect, test } from '../fixtures/base';

test('activity shows escaped before/after content and restores history into a draft', async ({
  authenticatedPage: page,
}) => {
  const name = `Activity ${randomUUID()}`;
  const created = await page.request.post('/api/prompts/create', {
    form: { requestKey: randomUUID(), name },
    maxRedirects: 0,
  });
  expect(created.status()).toBe(302);
  const id = created.headers().location.split('/').at(-1);
  if (!id) throw new Error('Missing prompt ID');
  const read = async () => {
    const response = await page.request.get(
      `/api/authoring/read?kind=prompt&id=${id}`,
    );
    expect(response.ok()).toBe(true);
    return (await response.json()) as BrowserAuthoringDocument;
  };
  try {
    let document = await read();
    const original =
      '<img src=x onerror="window.activityInjected=true"> original';
    const save = async (systemMessage: string) => {
      const response = await page.request.post('/api/authoring/save', {
        form: {
          kind: 'prompt',
          id,
          expectedRevision: document.revision ?? '',
          requestKey: randomUUID(),
          patch: JSON.stringify({ systemMessage }),
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      document = (await response.json()).document;
    };
    await save(original);
    const published = await page.request.post('/api/prompts/publish', {
      form: {
        promptId: id,
        expectedRevision: document.revision ?? '',
        requestKey: randomUUID(),
        version: '1.0.0',
      },
    });
    expect(published.ok(), await published.text()).toBe(true);
    document = (await published.json()).document;
    await save('Updated working draft');
    await page.goto(`/activity?kind=prompt&id=${id}`);
    await page
      .getByRole('link', { name: new RegExp(`${name} · Edited`) })
      .first()
      .click();
    const changes = page.getByRole('region', { name: 'systemMessage changes' });
    await expect(changes).toContainText(original);
    await expect(changes).toContainText('Updated working draft');
    expect(
      await page.evaluate(() => Object.hasOwn(window, 'activityInjected')),
    ).toBe(false);
    await page.getByRole('button', { name: 'Restore before as draft' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('button', { name: 'Restore draft', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    document = await read();
    expect(document.version.status).toBe('draft');
    expect(document.definition).toMatchObject({ systemMessage: original });
    await page.goto(`/prompts/${id}?version=1.0.0`);
    await expect(page.locator('#textarea-system-prompt')).toHaveValue(original);
    await page.goto(`/activity?kind=prompt&id=${id}`);
    await expect(
      page.getByRole('link', { name: new RegExp(`${name} · Restored`) }),
    ).toBeVisible();
  } finally {
    const current = await read();
    const response = await page.request.post('/api/prompts/delete', {
      form: {
        promptId: id,
        expectedRevision: current.revision ?? '',
        requestKey: randomUUID(),
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});
