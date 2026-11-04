import { execFileSync } from 'node:child_process';
import { expect, test } from '../fixtures/base';

test('MCP setup copies authoring and testing scopes in each client format and explains the consent choice', async ({
  authenticatedPage: page,
}, testInfo) => {
  const session = await page.request.get('/api/auth/get-session');
  const { user } = await session.json();
  await page.addInitScript((userId: string) => {
    localStorage.setItem(`promptly:onboarding-skipped:${userId}`, '1');
  }, user.id);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/settings?tab=mcp');

  const setup = page.locator('section[aria-labelledby="mcp-setup-heading"]');
  await expect(setup).toContainText('Draft editing is selected by default');
  await expect(setup).toContainText(
    'publishing is enabled only if you select it',
  );
  await expect(setup).toContainText(
    'Existing permissions do not expand automatically',
  );
  await expect(setup).toContainText(
    'Run tests is a separate choice, off by default',
  );
  await expect(setup).toContainText('LLM API keys with API costs');
  const copied: Record<string, string> = {};
  for (const name of ['Codex', 'Claude Code', 'Cursor']) {
    const guide = setup.locator('details').filter({
      has: page.locator('summary').filter({ hasText: new RegExp(`^${name}$`) }),
    });
    await guide.locator('summary').click();
    const code = await guide.locator('code').innerText();
    await guide
      .getByRole('button', { name: `Copy ${name.toLowerCase()} setup` })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(code);
    copied[name] = code;
  }

  expect(copied.Codex).toBe(
    'codex mcp add promptly --url http://localhost:5173/mcp\ncodex mcp login promptly --scopes mcp:read,mcp:write,mcp:publish,mcp:run',
  );
  const claudeConfig = copied['Claude Code'].match(
    /^claude mcp add-json promptly '(.+)'$/,
  );
  expect(claudeConfig).not.toBeNull();
  expect(JSON.parse(claudeConfig?.[1] ?? '{}')).toEqual({
    type: 'http',
    url: 'http://localhost:5173/mcp',
    oauth: { scopes: 'mcp:read mcp:write mcp:publish mcp:run' },
  });
  expect(JSON.parse(copied.Cursor).mcpServers.promptly).toEqual({
    url: 'http://localhost:5173/mcp',
    auth: {
      CLIENT_ID: 'YOUR_PROMPTLY_CLIENT_ID',
      scopes: ['mcp:read', 'mcp:write', 'mcp:publish', 'mcp:run'],
    },
  });

  for (const name of ['Codex', 'Cursor']) {
    await setup.getByText(name, { exact: true }).click();
  }
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate((enabled) => {
      document.documentElement.classList.toggle('dark', enabled);
    }, dark);
    await expect(setup.getByText('Claude Code', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await setup
      .locator('details')
      .filter({
        has: page.locator('summary').filter({ hasText: /^Claude Code$/ }),
      })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`mcp-setup-${dark ? 'dark' : 'light'}-375.png`),
    });
  }
});

test('MCP setup requests only read access when authoring or workspace access is disabled', async ({
  page,
}) => {
  for (const flags of [
    { enabled: true, authoringEnabled: false },
    { enabled: false, authoringEnabled: true },
  ]) {
    await page.setContent(
      // Bun renders JSX normally; Playwright's transform targets component fixtures.
      execFileSync(
        'bun',
        [
          '-e',
          `import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpSettings } from './app/components/mcp-settings';
console.log(renderToStaticMarkup(createElement(McpSettings, {
  ...JSON.parse(process.argv[1]),
  serverUrl: 'https://app.promptlycms.com/mcp',
  connections: [],
  canManageWorkspaceConnections: false,
})));`,
          JSON.stringify(flags),
        ],
        { encoding: 'utf8' },
      ),
    );
    for (const summary of await page.locator('details > summary').all()) {
      await summary.click();
    }
    const configs = await page.locator('details code').allTextContents();
    expect(configs).toHaveLength(3);
    expect(configs[0]).toContain('codex mcp login promptly --scopes mcp:read');
    expect(configs[1]).toContain('"scopes":"mcp:read"');
    expect(JSON.parse(configs[2]).mcpServers.promptly.auth.scopes).toEqual([
      'mcp:read',
    ]);
    for (const config of configs) {
      expect(config).not.toContain('mcp:write');
      expect(config).not.toContain('mcp:publish');
      expect(config).not.toContain('mcp:run');
    }
    await expect(
      page.getByText(/These settings request read-only access/),
    ).toBeVisible();
  }
});

test('MCP setup copies a prompt that hands the setup guide to the assistant', async ({
  authenticatedPage: page,
}) => {
  const session = await page.request.get('/api/auth/get-session');
  const { user } = await session.json();
  await page.addInitScript((userId: string) => {
    localStorage.setItem(`promptly:onboarding-skipped:${userId}`, '1');
  }, user.id);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/settings?tab=mcp');

  const setup = page.locator('section[aria-labelledby="mcp-setup-heading"]');
  await setup.getByRole('button', { name: 'Copy setup prompt' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      'Read https://docs.promptlycms.com/mcp/connect.md, then connect yourself to the Promptly MCP server at http://localhost:5173/mcp by following the steps for your app. Run the commands yourself and tell me when I need to sign in.',
    );
  await expect(
    setup.getByRole('link', { name: /setup guide/ }),
  ).toHaveAttribute('href', 'https://docs.promptlycms.com/mcp/connect/');
});

test('workspace admins add an MCP server, see its key once, then rotate and remove it', async ({
  authenticatedPage: page,
}) => {
  // The test user persists between runs and server IDs are global, so each run uses its own.
  const name = `Pagentic ${Date.now()}`;
  const id = name.toLowerCase().replace(' ', '-');
  await page.goto('/settings?tab=mcp');
  const section = page.locator(
    'section[aria-labelledby="mcp-servers-heading"]',
  );
  await section.getByRole('button', { name: 'Add server' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await expect(dialog.getByLabel('ID')).toHaveValue(id);
  await dialog.getByLabel('MCP URL').fill(`https://${id}.example/mcp`);
  await dialog.getByRole('button', { name: 'Add server' }).click();
  await expect(dialog).toContainText(`${name} added`);
  const key = await dialog.locator('code').first().innerText();
  expect(key).toMatch(/^promptly_mcp_[\w-]{43}$/);
  await expect(dialog.locator('code').nth(1)).toHaveText(
    `http://localhost:5173/api/mcp/external/${id}`,
  );
  await dialog.getByRole('button', { name: 'Done' }).click();

  const row = section.getByRole('listitem').filter({ hasText: name });
  await expect(row).toContainText(`${key.slice(0, 17)}…`);
  await expect(row).not.toContainText(key);

  await row.getByRole('button', { name: `Rotate the key for ${name}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Rotate key' }).click();
  await expect(dialog).toContainText(`New key for ${name}`);
  const rotated = await dialog.locator('code').first().innerText();
  expect(rotated).toMatch(/^promptly_mcp_[\w-]{43}$/);
  expect(rotated).not.toBe(key);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(row).toContainText(`${rotated.slice(0, 17)}…`);

  await row.getByRole('button', { name: `Remove ${name}` }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove server' })
    .click();
  await expect(row).toHaveCount(0);
});
