import { createHash, randomBytes } from 'node:crypto';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { expect, test } from '../fixtures/base';

const origin = 'http://localhost:5173';
const callback = 'http://127.0.0.1:49199/callback';

const readRpcResponse = async (response: APIResponse) => {
  if (response.headers()['content-type']?.startsWith('text/event-stream')) {
    const event = (await response.text())
      .split('\n')
      .find((line) => line.startsWith('data:'));
    expect(event).toBeDefined();
    return JSON.parse(event?.slice(5) ?? 'null');
  }
  return response.json();
};

const registerClient = async (page: Page, redirectUri = callback) => {
  const sessionResponse = await page.request.get('/api/auth/get-session');
  expect(sessionResponse.ok()).toBe(true);
  const { user } = await sessionResponse.json();
  // Each browser context starts fresh; the welcome tour can intercept Settings.
  await page.addInitScript((userId: string) => {
    localStorage.setItem(`promptly:onboarding-skipped:${userId}`, '1');
  }, user.id);
  const name = `MCP test ${randomBytes(6).toString('hex')}`;
  await page.goto('/settings/mcp/clients');
  await page.getByLabel('Client name', { exact: true }).fill(name);
  await page.getByLabel('Callback URLs').fill(redirectUri);
  await page
    .getByRole('button', { name: 'Register client', exact: true })
    .click();
  await expect(
    page.getByText('Client registered', { exact: true }),
  ).toBeVisible();
  return {
    id: await page.getByLabel('Client ID', { exact: true }).inputValue(),
    name,
  };
};

const authorizationUrl = (
  clientId: string,
  scope = 'mcp:read mcp:write mcp:publish',
  redirectUri = callback,
) => {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('hex');
  const url = new URL('/oauth/authorize', origin);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    scope,
    state,
    resource: `${origin}/mcp`,
  }).toString();
  return { url: url.toString(), verifier, state };
};

const exchangeCode = async (
  request: APIRequestContext,
  clientId: string,
  code: string,
  verifier: string,
  redirectUri = callback,
) =>
  request.post('/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: `${origin}/mcp`,
    },
  });

const callTool = (
  request: APIRequestContext,
  token: string,
  name = 'get_connection',
  args: Record<string, unknown> = {},
) =>
  request.post('/mcp', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': name,
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    },
  });

test('MCP discovery challenges use OAuth metadata and reject untrusted resources', async ({
  request,
}) => {
  const response = await request.post('/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()['www-authenticate']).toContain(
    '/.well-known/oauth-protected-resource/mcp',
  );
  const resource = await request.get(
    '/.well-known/oauth-protected-resource/mcp',
  );
  expect(resource.status()).toBe(200);
  expect((await resource.json()).resource).toBe(`${origin}/mcp`);
  const metadata = await request.get('/.well-known/oauth-authorization-server');
  const details = await metadata.json();
  expect(details.authorization_endpoint).toBe(`${origin}/oauth/authorize`);
  expect(details.client_id_metadata_document_supported).toBe(true);
  expect(details.registration_endpoint).toBeUndefined();
  expect(details.code_challenge_methods_supported).toEqual(['S256']);
});

test('MCP supports the exact Cursor native callback with mandatory PKCE and rejects redirect substitutions', async ({
  authenticatedPage: page,
}) => {
  const nativeCallback = 'cursor://anysphere.cursor-mcp/oauth/callback';
  const client = await registerClient(page, nativeCallback);
  const auth = authorizationUrl(client.id, 'mcp:read', nativeCallback);
  for (const redirectUri of [
    `${nativeCallback}/`,
    `${nativeCallback}?next=https://untrusted.example`,
    `${nativeCallback}#fragment`,
    'cursor://untrusted.example/oauth/callback',
    'vscode://anysphere.cursor-mcp/oauth/callback',
    callback,
  ]) {
    const invalid = new URL(auth.url);
    invalid.searchParams.set('redirect_uri', redirectUri);
    const response = await page.request.get(invalid.toString(), {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    expect(response.headers().location).toBeUndefined();
  }
  const noPkce = new URL(auth.url);
  noPkce.searchParams.delete('code_challenge');
  noPkce.searchParams.delete('code_challenge_method');
  expect((await page.request.get(noPkce.toString())).status()).toBe(400);

  await page.goto(auth.url);
  for (const dark of [false, true]) {
    await page.evaluate((enabled) => {
      document.documentElement.classList.toggle('dark', enabled);
    }, dark);
    await expect(page.getByText(nativeCallback, { exact: true })).toBeVisible();
  }
  const requestId = await page.locator('input[name="requestId"]').inputValue();
  const consent = await page.request.post('/oauth/authorize', {
    headers: { Origin: origin },
    form: { requestId, permission: 'read', decision: 'allow' },
    maxRedirects: 0,
  });
  expect(consent.status()).toBe(302);
  const destination = new URL(consent.headers().location);
  expect(
    `${destination.protocol}//${destination.host}${destination.pathname}`,
  ).toBe(nativeCallback);
  expect(destination.searchParams.get('state')).toBe(auth.state);
  expect(destination.searchParams.get('iss')).toBe(origin);
  const code = destination.searchParams.get('code') ?? '';
  expect(code).not.toBe('');
  const wrongRedirect = await exchangeCode(
    page.request,
    client.id,
    code,
    auth.verifier,
    `${nativeCallback}/`,
  );
  expect(wrongRedirect.status()).toBe(400);
  const wrongVerifier = await exchangeCode(
    page.request,
    client.id,
    code,
    randomBytes(32).toString('base64url'),
    nativeCallback,
  );
  expect(wrongVerifier.status()).toBe(400);
  const response = await exchangeCode(
    page.request,
    client.id,
    code,
    auth.verifier,
    nativeCallback,
  );
  expect(response.status()).toBe(200);
  const tokens = await response.json();
  expect((await callTool(page.request, tokens.access_token)).status()).toBe(
    200,
  );
});

test('MCP OAuth defaults to draft permissions, supports tools and refresh, and revokes immediately', async ({
  authenticatedPage: page,
}) => {
  const client = await registerClient(page);
  const discovery = await page.request.get(
    '/.well-known/oauth-protected-resource/mcp',
  );
  expect(discovery.ok()).toBe(true);
  const advertised = (await discovery.json()).scopes_supported;
  expect(advertised).toEqual(['mcp:read', 'mcp:write', 'mcp:publish']);
  // Follow the discovery-driven scope request used by coding/chat clients.
  const auth = authorizationUrl(client.id, advertised.join(' '));
  await page.route(`${callback}*`, (route) =>
    route.fulfill({ body: 'Connected', contentType: 'text/plain' }),
  );
  await page.goto(auth.url);
  await expect(page.getByRole('radio')).toHaveCount(3);
  for (const name of [
    /^Read only/,
    /^Create and edit drafts/,
    /^Create, edit, and publish/,
  ])
    await expect(page.getByRole('radio', { name })).toBeEnabled();
  await expect(
    page.getByRole('radio', { name: /^Create and edit drafts/ }),
  ).toBeChecked();
  await expect(
    page.getByRole('radio', { name: /^Create, edit, and publish/ }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForURL((url) => url.origin === new URL(callback).origin);
  const result = new URL(page.url());
  expect(result.searchParams.get('state')).toBe(auth.state);
  expect(result.searchParams.get('iss')).toBe(origin);
  const code = result.searchParams.get('code');
  expect(code).toBeTruthy();
  const tokensResponse = await exchangeCode(
    page.request,
    client.id,
    code ?? '',
    auth.verifier,
  );
  expect(tokensResponse.status()).toBe(200);
  const tokens = await tokensResponse.json();
  expect(tokens.scope.split(' ').sort()).toEqual(['mcp:read', 'mcp:write']);
  const call = await callTool(page.request, tokens.access_token);
  expect(call.status(), await call.text()).toBe(200);
  const callResult = await call.json();
  expect(callResult.result.structuredContent.scopes).toEqual([
    'mcp:read',
    'mcp:write',
  ]);
  expect(callResult.result.structuredContent.authoringAvailable).toBe(true);
  // Coding clients still negotiate the pre-v2 Streamable HTTP lifecycle.
  const legacyHeaders = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-11-25',
  };
  const initialized = await page.request.post('/mcp', {
    headers: legacyHeaders,
    data: {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'Promptly compatibility test', version: '1.0.0' },
      },
    },
  });
  expect(initialized.status()).toBe(200);
  expect((await readRpcResponse(initialized)).result.protocolVersion).toBe(
    '2025-11-25',
  );
  const legacyCall = await page.request.post('/mcp', {
    headers: legacyHeaders,
    data: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_connection', arguments: {} },
    },
  });
  expect(legacyCall.status()).toBe(200);
  expect(
    (await readRpcResponse(legacyCall)).result.structuredContent.workspaceId,
  ).toBe(callResult.result.structuredContent.workspaceId);
  const search = await callTool(
    page.request,
    tokens.access_token,
    'search_content',
    { limit: 2 },
  );
  expect(search.status()).toBe(200);
  const searchResult = await search.json();
  expect(Array.isArray(searchResult.result.structuredContent.items)).toBe(true);
  const refreshed = await page.request.post('/oauth/token', {
    form: {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: tokens.refresh_token,
      resource: `${origin}/mcp`,
      scope: 'mcp:read',
    },
  });
  expect(refreshed.status()).toBe(200);
  const next = await refreshed.json();
  const narrowed = await callTool(page.request, next.access_token);
  expect(narrowed.status()).toBe(200);
  expect((await narrowed.json()).result.structuredContent.scopes).toEqual([
    'mcp:read',
  ]);
  await page.goto('/settings?tab=mcp');
  const connection = page
    .locator('form')
    .filter({ has: page.locator(`input[name="connectionId"]`) })
    .filter({
      has: page.getByRole('button', { name: new RegExp(client.name) }),
    });
  await connection.getByRole('button').click();
  await expect(
    page.getByText('Connection revoked.', { exact: true }),
  ).toBeVisible();
  expect((await callTool(page.request, next.access_token)).status()).toBe(401);
  expect((await callTool(page.request, tokens.access_token)).status()).toBe(
    401,
  );
  const afterRevoke = await page.request.post('/oauth/token', {
    form: {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: next.refresh_token,
      resource: `${origin}/mcp`,
    },
  });
  expect(afterRevoke.ok()).toBe(false);
});

test('MCP consent rejects CSRF, permissions escalation, bad resource and missing PKCE', async ({
  authenticatedPage: page,
}) => {
  const client = await registerClient(page);
  const auth = authorizationUrl(client.id, 'mcp:read');
  await page.goto(auth.url);
  await expect(page.getByRole('radio', { name: /^Read only/ })).toBeChecked();
  await expect(
    page.getByRole('radio', { name: /^Create and edit drafts/ }),
  ).toBeDisabled();
  const requestId = await page.locator('input[name="requestId"]').inputValue();
  const crossOrigin = await page.request.post('/oauth/authorize', {
    headers: { Origin: 'https://untrusted.example' },
    form: { requestId, permission: 'publish', decision: 'allow' },
  });
  expect([400, 403]).toContain(crossOrigin.status());
  const escalated = await page.request.post('/oauth/authorize', {
    headers: { Origin: origin },
    form: { requestId, permission: 'publish', decision: 'allow' },
  });
  expect(escalated.status()).toBe(400);
  const badResource = new URL(auth.url);
  badResource.searchParams.set('resource', 'https://untrusted.example/mcp');
  expect((await page.request.get(badResource.toString())).status()).toBe(400);
  const noPkce = new URL(auth.url);
  noPkce.searchParams.delete('code_challenge');
  noPkce.searchParams.delete('code_challenge_method');
  expect((await page.request.get(noPkce.toString())).status()).toBe(400);
});

test('MCP publishing requires an explicit consent choice and authorization codes cannot be replayed', async ({
  authenticatedPage: page,
}) => {
  const client = await registerClient(page);
  const discovery = await page.request.get(
    '/.well-known/oauth-protected-resource/mcp',
  );
  expect(discovery.ok()).toBe(true);
  const advertised = (await discovery.json()).scopes_supported;
  expect(advertised).toEqual(['mcp:read', 'mcp:write', 'mcp:publish']);
  const auth = authorizationUrl(client.id, advertised.join(' '));
  await page.route(`${callback}*`, (route) =>
    route.fulfill({ body: 'Connected' }),
  );
  await page.goto(auth.url);
  await expect(
    page.getByRole('radio', { name: /^Create and edit drafts/ }),
  ).toBeChecked();
  await expect(
    page.getByRole('radio', { name: /^Create, edit, and publish/ }),
  ).not.toBeChecked();
  await page.getByRole('radio', { name: /^Create, edit, and publish/ }).check();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForURL((url) => url.origin === new URL(callback).origin);
  const code = new URL(page.url()).searchParams.get('code') ?? '';
  const badVerifier = await exchangeCode(
    page.request,
    client.id,
    code,
    randomBytes(32).toString('base64url'),
  );
  expect(badVerifier.status()).toBe(400);
  const response = await exchangeCode(
    page.request,
    client.id,
    code,
    auth.verifier,
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).scope.split(' ').sort()).toEqual([
    'mcp:publish',
    'mcp:read',
    'mcp:write',
  ]);
  expect(
    (await exchangeCode(page.request, client.id, code, auth.verifier)).status(),
  ).toBe(400);
});

test('MCP token revocation verifies token ownership and permanently revokes the connection', async ({
  authenticatedPage: page,
}) => {
  const foreignClient = await registerClient(page);
  await page.route(`${callback}*`, (route) =>
    route.fulfill({ body: 'Connected' }),
  );
  for (const tokenType of ['access_token', 'refresh_token'] as const) {
    const client = await registerClient(page);
    const auth = authorizationUrl(client.id, 'mcp:read');
    await page.goto(auth.url);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.waitForURL((url) => url.origin === new URL(callback).origin);
    const response = await exchangeCode(
      page.request,
      client.id,
      new URL(page.url()).searchParams.get('code') ?? '',
      auth.verifier,
    );
    expect(response.status()).toBe(200);
    const tokens = await response.json();
    const revoke = (clientId: string, token: string) =>
      page.request.post('/oauth/token', {
        form: {
          client_id: clientId,
          token,
          token_type_hint: tokenType,
        },
      });
    const forged = `${tokens[tokenType].split(':').slice(0, 2).join(':')}:invalid`;
    expect((await revoke(client.id, forged)).status()).toBe(200);
    expect((await callTool(page.request, tokens.access_token)).status()).toBe(
      200,
    );
    expect((await revoke(foreignClient.id, tokens[tokenType])).status()).toBe(
      200,
    );
    expect((await callTool(page.request, tokens.access_token)).status()).toBe(
      200,
    );
    expect((await revoke(client.id, tokens[tokenType])).status()).toBe(200);
    expect((await callTool(page.request, tokens.access_token)).status()).toBe(
      401,
    );
    const refreshed = await page.request.post('/oauth/token', {
      form: {
        grant_type: 'refresh_token',
        client_id: client.id,
        refresh_token: tokens.refresh_token,
        resource: `${origin}/mcp`,
      },
    });
    expect(refreshed.ok()).toBe(false);
  }
});
