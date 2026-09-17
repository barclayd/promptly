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
