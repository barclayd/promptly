import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { BrowserAuthoringDocument } from '../../app/lib/authoring/browser-types';
import { test as base, expect } from '../fixtures/base';

const test = base.extend({
  authenticatedPage: async ({ authenticatedPage: page }, use) => {
    const response = await page.request.get('/api/auth/get-session');
    const session = (await response.json()) as { user: { id: string } };
    const skipTour = (userId: string) =>
      localStorage.setItem(`promptly:onboarding-skipped:${userId}`, '1');
    await page.addInitScript(skipTour, session.user.id);
    await page.evaluate(skipTour, session.user.id);
    await use(page);
  },
});

const readDocument = async (
  page: Page,
  kind: 'prompt' | 'composer',
  id: string,
) => {
  const response = await page.request.get(
    `/api/authoring/read?kind=${kind}&id=${id}`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as BrowserAuthoringDocument;
};
const createDocument = async (page: Page, kind: 'prompt' | 'composer') => {
  const response = await page.request.post(`/api/${kind}s/create`, {
    form: {
      requestKey: randomUUID(),
      name: `Browser revision ${randomUUID()}`,
    },
    maxRedirects: 0,
  });
  expect(response.status(), await response.text()).toBe(302);
  const url = response.headers().location;
  const id = url.split('/').at(-1);
  if (!id) throw new Error('Missing new document ID');
  return { id, url };
};
const saveRemote = async (
  page: Page,
  document: BrowserAuthoringDocument,
  patch: Record<string, unknown>,
) => {
  const response = await page.request.post('/api/authoring/save', {
    form: {
      kind: document.kind,
      id: document.id,
      expectedRevision: document.revision ?? '',
      requestKey: randomUUID(),
      patch: JSON.stringify(patch),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).document as BrowserAuthoringDocument;
};
const removeDocument = async (
  page: Page,
  kind: 'prompt' | 'composer',
  id: string,
) => {
  const document = await readDocument(page, kind, id);
  const response = await page.request.post(`/api/${kind}s/delete`, {
    form: {
      [`${kind}Id`]: id,
      expectedRevision: document.revision ?? '',
      requestKey: randomUUID(),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
};

test('browser prompt save preserves edits made during an in-flight save and undo is persisted', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'prompt');
  const intercepted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const requests: URLSearchParams[] = [];
  let first = true;
  await page.route('**/api/authoring/save', async (route) => {
    requests.push(new URLSearchParams(route.request().postData() ?? ''));
    const response = await route.fetch();
    if (first) {
      first = false;
      intercepted.resolve();
      await release.promise;
    }
    await route.fulfill({ response });
  });
  try {
    await page.goto(url);
    const system = page.locator('#textarea-system-prompt');
    const user = page.locator('#textarea-user-prompt');
    await system.fill('First save');
    await intercepted.promise;
    await system.fill('Latest local edit');
    await user.fill('A separate user edit');
    release.resolve();
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    let saved = await readDocument(page, 'prompt', id);
    expect(saved.definition).toMatchObject({
      systemMessage: 'Latest local edit',
      userMessage: 'A separate user edit',
    });
    await user.focus();
    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
    );
    await expect(user).not.toHaveValue('A separate user edit');
    const undone = await user.inputValue();
    await expect
      .poll(async () => (await readDocument(page, 'prompt', id)).definition)
      .toMatchObject({ userMessage: undone });
    saved = await readDocument(page, 'prompt', id);
    expect(saved.definition).toMatchObject({
      systemMessage: await system.inputValue(),
    });
    expect(requests.length).toBeGreaterThanOrEqual(3);
  } finally {
    release.resolve();
    await page.unroute('**/api/authoring/save');
    await removeDocument(page, 'prompt', id);
  }
});

test('clean editors adopt committed changes and dirty drafts require explicit conflict resolution', async ({
  authenticatedPage: page,
}, testInfo) => {
  const { id, url } = await createDocument(page, 'prompt');
  try {
    await page.goto(url);
    const system = page.locator('#textarea-system-prompt');
    const original = await readDocument(page, 'prompt', id);
    const first = await saveRemote(page, original, {
      systemMessage: 'Remote clean edit',
    });
    await expect(system).toHaveValue('Remote clean edit');
    await system.fill('Keep this local work');
    await saveRemote(page, first, { userMessage: 'Remote user edit' });
    await expect(
      page.getByText('This draft changed elsewhere', { exact: true }),
    ).toBeVisible();
    await expect(system).toHaveValue('Keep this local work');
    await page
      .getByText('Review local and saved changes', { exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Your local draft' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Saved version' }),
    ).toBeVisible();
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(
          (nextTheme) =>
            document.documentElement.classList.toggle(
              'dark',
              nextTheme === 'dark',
            ),
          theme,
        );
        await expect(system).toHaveValue('Keep this local work');
        await expect(
          page.getByRole('button', { name: 'Reapply my changes', exact: true }),
        ).toBeEnabled();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        const panel = page.getByRole('region', { name: 'Draft save status' });
        if ((await panel.locator('details').getAttribute('open')) === null)
          await panel.locator('summary').click();
        await expect(
          panel.getByRole('button', {
            name: 'Reapply my changes',
            exact: true,
          }),
        ).toHaveCSS('opacity', '1');
        await panel.screenshot({
          path: testInfo.outputPath(`conflict-${theme}-${width}.png`),
        });
      }
    }

    await page
      .getByRole('button', { name: 'Reapply my changes', exact: true })
      .click();
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    const saved = await readDocument(page, 'prompt', id);
    expect(saved.definition).toMatchObject({
      systemMessage: 'Keep this local work',
      userMessage: 'Remote user edit',
    });
  } finally {
    await removeDocument(page, 'prompt', id);
  }
});

test('composer content adopts saved revisions and stale legacy writers are rejected', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'composer');
  try {
    await page.goto(url);
    const editor = page.locator('.tiptap');
    await expect(editor).toBeVisible();
    await editor.fill('Composer local content');
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    const initial = await readDocument(page, 'composer', id);
    expect(initial.definition).toMatchObject({
      content: '<p>Composer local content</p>',
    });
    const saved = await saveRemote(page, initial, {
      content: '<h2>Saved elsewhere</h2><p>Latest composer</p>',
    });
    await expect(editor).toContainText('Saved elsewhere');
    const stale = await page.request.post('/api/composers/save-config', {
      form: {
        composerId: id,
        config: '{}',
        expectedRevision: initial.revision ?? '',
        requestKey: randomUUID(),
      },
    });
    expect(stale.status()).toBe(409);
    const blind = await page.request.post('/api/composers/save-content', {
      form: { composerId: id, content: '<p>Lost revision</p>' },
    });
    expect(blind.status()).toBe(428);
    expect((await readDocument(page, 'composer', id)).revision).toBe(
      saved.revision,
    );
  } finally {
    await removeDocument(page, 'composer', id);
  }
});

test('browser dialogs create, edit details, flush before publishing, protect history, and delete', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/prompts');
  await page
    .getByRole('button', { name: 'Create', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  const name = `Dialog lifecycle ${randomUUID()}`;
  await dialog.locator('input[name="name"]').fill(name);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/);
  const id = new URL(page.url()).pathname.split('/').at(-1);
  if (!id) throw new Error('Missing prompt ID');
  let deleted = false;
  try {
    const system = page.locator('#textarea-system-prompt');
    await system.fill('Publish this pending edit');
    await page.getByRole('menubar').getByText('Edit', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit Details...' }).click();
    await dialog.locator('input[name="name"]').fill(`${name} renamed`);
    await dialog
      .locator('textarea[name="description"]')
      .fill('A saved description');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: `${name} renamed` }),
    ).toBeVisible();
    await system.fill('A newer edit immediately before publishing');
    await page
      .getByRole('button', { name: 'Publish', exact: true })
      .first()
      .click();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const published = await readDocument(page, 'prompt', id);
    expect(published.version).toMatchObject({
      status: 'published',
      version: '1.0.0',
    });
    expect(published.definition).toMatchObject({
      name: `${name} renamed`,
      description: 'A saved description',
      systemMessage: 'A newer edit immediately before publishing',
    });
    await page.goto(`/prompts/${id}?version=1.0.0`);
    await expect(system).toBeDisabled();
    const historicalSave = await page.request.post(
      `/prompts/${id}?version=1.0.0`,
      {
        form: {
          expectedRevision: published.revision ?? '',
          requestKey: randomUUID(),
          systemMessage: 'Must not mutate history',
        },
      },
    );
    expect(historicalSave.status()).toBe(400);
    await page.goto(`/prompts/${id}?version=9.9.9`);
    await expect(
      page.getByRole('heading', { name: 'Version not found' }),
    ).toBeVisible();
    await expect(system).not.toBeVisible();
    await page
      .getByRole('button', { name: 'Back to latest', exact: true })
      .click();
    await expect(system).toHaveValue(
      'A newer edit immediately before publishing',
    );
    expect((await readDocument(page, 'prompt', id)).revision).toBe(
      published.revision,
    );
    await page.getByRole('menubar').getByText('File', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForURL(/\/prompts$/);
    deleted = true;
    expect(
      (
        await page.request.get(`/api/authoring/read?kind=prompt&id=${id}`)
      ).status(),
    ).toBe(404);
  } finally {
    if (!deleted) await removeDocument(page, 'prompt', id);
  }
});

test('browser retries an uncertain committed save with the original key before saving later edits', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'prompt');
  const mutations: Record<string, FormDataEntryValue>[] = [];
  let loseResponse = true;
  await page.route('**/api/authoring/save', async (route) => {
    const request = route.request();
    const body = await new Request('http://localhost/save', {
      method: 'POST',
      headers: request.headers(),
      body: request.postData(),
    }).formData();
    mutations.push(Object.fromEntries(body));
    const response = await route.fetch();
    if (loseResponse) {
      loseResponse = false;
      await route.abort('failed');
    } else await route.fulfill({ response });
  });
  try {
    await page.goto(url);
    const system = page.locator('#textarea-system-prompt');
    await system.fill('First committed text');
    await expect(
      page.getByRole('button', { name: 'Retry save', exact: true }),
    ).toBeVisible();
    await system.fill('Later local text');
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    expect(mutations).toHaveLength(3);
    expect(mutations[1]).toEqual(mutations[0]);
    expect(mutations[2].requestKey).not.toBe(mutations[0].requestKey);
    expect((await readDocument(page, 'prompt', id)).definition).toMatchObject({
      systemMessage: 'Later local text',
    });
  } finally {
    await page.unroute('**/api/authoring/save');
    await removeDocument(page, 'prompt', id);
  }
});

test('an open publication dialog requires fresh review after a foreign commit', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'prompt');
  try {
    await page.goto(url);
    const system = page.locator('#textarea-system-prompt');
    await system.fill('Original reviewed content');
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Publish', exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeEnabled();
    const original = await readDocument(page, 'prompt', id);
    const foreign = await saveRemote(page, original, {
      systemMessage: 'Changed while the dialog was open',
    });
    await expect(system).toHaveValue('Changed while the dialog was open');
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    const after = await readDocument(page, 'prompt', id);
    expect(after.revision).toBe(foreign.revision);
    expect(after.version.status).toBe('draft');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page
      .getByRole('button', { name: 'Publish', exact: true })
      .first()
      .click();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await readDocument(page, 'prompt', id)).version.status).toBe(
      'published',
    );
  } finally {
    await removeDocument(page, 'prompt', id);
  }
});

test('a pending restore cannot be retried as a different history phase', async ({
  authenticatedPage: page,
}) => {
  const { id } = await createDocument(page, 'prompt');
  const mutations: Record<string, FormDataEntryValue>[] = [];
  let loseResponse = true;
  await page.route('**/api/authoring/restore', async (route) => {
    const request = route.request();
    const body = await new Request('http://localhost/restore', {
      method: 'POST',
      headers: request.headers(),
      body: request.postData(),
    }).formData();
    mutations.push(Object.fromEntries(body));
    const response = await route.fetch();
    if (loseResponse) {
      loseResponse = false;
      await route.abort('failed');
    } else await route.fulfill({ response });
  });
  try {
    let current = await readDocument(page, 'prompt', id);
    current = await saveRemote(page, current, {
      systemMessage: 'Before this change',
    });
    current = await saveRemote(page, current, {
      systemMessage: 'After this change',
    });
    await page.goto(`/activity?kind=prompt&id=${id}`);
    await page
      .getByRole('link', {
        name: new RegExp(`${current.definition.name} · Edited`),
      })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Restore before as draft' }).click();
    await dialog
      .getByRole('button', { name: 'Restore draft', exact: true })
      .click();
    await expect(
      dialog.getByRole('button', { name: 'Retry restore', exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Restore after as draft' }).click();
    await dialog
      .getByRole('button', { name: 'Retry restore', exact: true })
      .click();
    await expect(dialog.getByRole('alert')).toContainText('earlier operation');
    expect(mutations).toHaveLength(1);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Restore before as draft' }).click();
    await dialog
      .getByRole('button', { name: 'Retry restore', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(mutations).toHaveLength(2);
    expect(mutations[1]).toEqual(mutations[0]);
    expect(mutations[1].phase).toBe('before');
    expect((await readDocument(page, 'prompt', id)).definition).toMatchObject({
      systemMessage: 'Before this change',
    });
  } finally {
    await page.unroute('**/api/authoring/restore');
    await removeDocument(page, 'prompt', id);
  }
});

test('an own save acknowledged after opening the publish dialog remains publishable', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'prompt');
  const committed = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route('**/api/authoring/save', async (route) => {
    const response = await route.fetch();
    committed.resolve();
    await release.promise;
    await route.fulfill({ response });
  });
  try {
    await page.goto(url);
    await page.locator('#textarea-system-prompt').fill('An edit I just made');
    await page
      .getByRole('button', { name: 'Publish', exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeEnabled();
    await committed.promise;
    release.resolve();
    await expect(
      page.getByText('All changes saved', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await readDocument(page, 'prompt', id)).version.status).toBe(
      'published',
    );
  } finally {
    release.resolve();
    await page.unroute('**/api/authoring/save');
    await removeDocument(page, 'prompt', id);
  }
});

test('restored committed content wins over stale legacy presence data across two editors', async ({
  authenticatedPage: page,
}) => {
  const { id, url } = await createDocument(page, 'prompt');
  const peer = await page.context().newPage();
  const sendLegacyContent = async () =>
    peer.evaluate(async (documentId) => {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(
          `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/presence/${documentId}`,
        );
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('Legacy presence test timed out'));
        }, 5000);
        socket.onopen = () => {
          socket.send(
            JSON.stringify({
              type: 'content_update',
              field: 'userMessage',
              value: 'Obsolete speculative text',
            }),
          );
          socket.send(JSON.stringify({ type: 'ping' }));
        };
        socket.onmessage = (event) => {
          if (JSON.parse(event.data).type === 'pong') {
            clearTimeout(timeout);
            socket.close();
            resolve();
          }
        };
        socket.onerror = () => {
          clearTimeout(timeout);
          socket.close();
          reject(new Error('Legacy presence test connection failed'));
        };
      });
    }, id);
  try {
    let current = await readDocument(page, 'prompt', id);
    current = await saveRemote(page, current, {
      userMessage: 'Original committed text',
    });
    current = await saveRemote(page, current, {
      userMessage: 'A later committed edit',
    });
    await page.goto(url);
    await peer.goto(url);
    await expect(peer.locator('#textarea-user-prompt')).toHaveValue(
      'A later committed edit',
    );
    await sendLegacyContent();
    await expect(peer.locator('#textarea-user-prompt')).toHaveValue(
      'A later committed edit',
    );
    await page.goto(`/activity?kind=prompt&id=${id}`);
    await page
      .getByRole('link', {
        name: new RegExp(`${current.definition.name} · Edited`),
      })
      .first()
      .click();
    await page.getByRole('button', { name: 'Restore before as draft' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('button', { name: 'Restore draft', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(peer.locator('#textarea-user-prompt')).toHaveValue(
      'Original committed text',
    );
    const restoredRevision = (await readDocument(page, 'prompt', id)).revision;
    await sendLegacyContent();
    await expect(peer.locator('#textarea-user-prompt')).toHaveValue(
      'Original committed text',
    );
    await page.goto(url);
    await expect(page.locator('#textarea-user-prompt')).toHaveValue(
      'Original committed text',
    );
    const afterNavigation = await readDocument(page, 'prompt', id);
    expect(afterNavigation.revision).toBe(restoredRevision);
    expect(afterNavigation.definition).toMatchObject({
      userMessage: 'Original committed text',
    });
  } finally {
    await peer.close();
    await removeDocument(page, 'prompt', id);
  }
});
