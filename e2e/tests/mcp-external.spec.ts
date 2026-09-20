import { createHash } from 'node:crypto';
import type { Miniflare } from 'miniflare';
import { z } from 'zod';
import { expect, test } from '../fixtures/base';
import { withMcpAuthoring } from '../fixtures/mcp-authoring';

const resource = 'https://engine.example/mcp';
const secret = 'test-only-external-service-secret-123456789';
const origin = 'https://mcp.test';
const verifier = 'a'.repeat(43);
const servers = [
  {
    id: 'engine',
    name: 'Preview engine',
    resource,
    organizationId: 'workspace',
    sharedSecret: secret,
  },
  {
    id: 'other',
    name: 'Other engine',
    resource: 'https://other.example/mcp',
    organizationId: 'workspace',
    sharedSecret: 'different-test-service-secret-123456789',
  },
  {
    id: 'foreign',
    name: 'Foreign engine',
    resource: 'https://foreign.example/mcp',
    organizationId: 'foreign',
    sharedSecret: 'foreign-test-service-secret-123456789',
  },
];
const fixture = (run: (runtime: Miniflare, db: D1Database) => Promise<void>) =>
  withMcpAuthoring(run, true, true, {
    workerEntry: new URL('../fixtures/mcp-external-worker.ts', import.meta.url),
    bindings: { MCP_EXTERNAL_SERVERS: JSON.stringify(servers) },
  });
const json = async (response: { json: () => Promise<unknown> }) =>
  z.record(z.string(), z.unknown()).parse(await response.json());
const consentSchema = z.object({
  requestId: z.string(),
  allowedPermissions: z.array(z.string()),
  defaultPermission: z.string(),
  testingRequested: z.boolean(),
  externalServer: z
    .object({ name: z.string(), resource: z.string() })
    .optional(),
});
const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  scope: z.string(),
});
const principalSchema = z.object({
  active: z.literal(true),
  userId: z.string(),
  organizationId: z.string(),
  connectionId: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.number(),
});

const begin = async (
  runtime: Miniflare,
  options: { resource?: string; scope?: string; omitResource?: boolean } = {},
) => {
  const client = z
    .object({ clientId: z.string() })
    .parse(
      await (await runtime.dispatchFetch(`${origin}/__fixture/client`)).json(),
    );
  const url = new URL(`${origin}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: 'https://client.example/callback',
    response_type: 'code',
    state: 'fixture-state',
    scope: options.scope ?? 'mcp:read mcp:run',
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  if (!options.omitResource)
    url.searchParams.set('resource', options.resource ?? resource);
  const response = await runtime.dispatchFetch(url);
  return { clientId: client.clientId, url, response };
};
const approve = async (
  runtime: Miniflare,
  requestId: string,
  overrides: Record<string, string> = {},
  headers: Record<string, string> = {},
) =>
  runtime.dispatchFetch(`${origin}/oauth/authorize`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams({
      requestId,
      permission: 'read',
      allowTesting: 'true',
      decision: 'allow',
      ...overrides,
    })
      .toString()
      .replace(/&allowTesting=(?=&|$)/, ''),
  });
const exchange = (
  runtime: Miniflare,
  input: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  runtime.dispatchFetch(`${origin}/oauth/token`, {
    method: 'POST',
    headers: {
      'X-Test-OAuth': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(input).toString(),
  });
const bridge = (
  runtime: Miniflare,
  body: unknown,
  headers: Record<string, string> = {},
  server = 'engine',
) =>
  runtime.dispatchFetch(`${origin}/api/mcp/external/${server}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
const connect = async (
  runtime: Miniflare,
  options: { run?: boolean; native?: boolean } = {},
) => {
  const started = await begin(runtime, {
    resource: options.native ? `${origin}/mcp` : resource,
    omitResource: options.native,
  });
  expect(started.response.status).toBe(200);
  const consent = consentSchema.parse(await started.response.json());
  const approved = await approve(
    runtime,
    consent.requestId,
    options.run === false ? { allowTesting: '' } : {},
  );
  expect(approved.status).toBe(302);
  const code = new URL(approved.headers.get('Location') ?? '').searchParams.get(
    'code',
  );
  expect(code).toBeTruthy();
  const response = await exchange(runtime, {
    grant_type: 'authorization_code',
    client_id: started.clientId,
    code: code ?? '',
    code_verifier: verifier,
    redirect_uri: 'https://client.example/callback',
  });
  expect(response.status).toBe(200);
  return {
    ...tokensSchema.parse(await response.json()),
    clientId: started.clientId,
    consent,
  };
};

test('external OAuth binds read/run consent to one audience and delegates exact draft reads', async () => {
  await fixture(async (runtime) => {
    const connected = await connect(runtime);
    expect(connected.consent).toMatchObject({
      allowedPermissions: ['read'],
      defaultPermission: 'read',
      testingRequested: true,
      externalServer: { name: 'Preview engine', resource },
    });
    expect(connected.scope).toBe('mcp:read mcp:run');
    const introspection = await bridge(runtime, {
      action: 'introspect',
      token: connected.access_token,
      resource,
    });
    expect(introspection.headers.get('Cache-Control')).toBe('no-store');
    const principal = principalSchema.parse(await introspection.json());
    expect(principal.expiresAt).toBeGreaterThan(Date.now());
    const subject = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      connectionId: principal.connectionId,
    };
    for (const [tool, id, field, content] of [
      ['get_prompt', 'prompt', 'systemMessage', 'Draft system'],
      ['get_composer', 'composer', 'content', '<p>Hello</p>'],
      ['get_snippet', 'snippet', 'content', 'Snippet draft'],
    ]) {
      const response = await bridge(runtime, {
        action: 'read',
        subject,
        tool,
        arguments: { id, version: { kind: 'draft' } },
      });
      expect(response.status).toBe(200);
      const payload = await json(response);
      expect(payload).toMatchObject({
        structuredContent: { definition: { [field]: content } },
      });
      const text = z
        .object({ content: z.array(z.object({ text: z.string() })) })
        .parse(payload).content[0]?.text;
      expect(JSON.parse(text ?? '{}')).toEqual(payload.structuredContent);
    }
    const status = await bridge(runtime, {
      action: 'read',
      subject,
      tool: 'get_connection',
      arguments: {},
    });
    expect(await status.json()).toMatchObject({
      structuredContent: {
        workspaceId: 'workspace',
        scopes: ['mcp:read', 'mcp:run'],
        canRunTests: true,
      },
    });
    const native = await runtime.dispatchFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        'X-Test-OAuth': 'true',
        Authorization: `Bearer ${connected.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    expect(native.status).toBe(401);
  });
});

test('external read-only consent does not issue run permission and live scope reductions apply to refresh and reads', async () => {
  await fixture(async (runtime, db) => {
    const connected = await connect(runtime, { run: false });
    expect(connected.scope).toBe('mcp:read');
    const principal = principalSchema.parse(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    );
    expect(principal.scopes).toEqual(['mcp:read']);
    const subject = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      connectionId: principal.connectionId,
    };
    expect(
      await (
        await bridge(runtime, {
          action: 'read',
          subject,
          tool: 'get_connection',
          arguments: {},
        })
      ).json(),
    ).toMatchObject({ structuredContent: { canRunTests: false } });
    const full = await connect(runtime);
    const fullPrincipal = principalSchema.parse(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: full.access_token,
          resource,
        })
      ).json(),
    );
    await db
      .prepare(
        'UPDATE mcp_connection SET scopes = \'["mcp:read"]\' WHERE id = ?',
      )
      .bind(fullPrincipal.connectionId)
      .run();
    expect(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: full.access_token,
          resource,
        })
      ).json(),
    ).toMatchObject({ active: true, scopes: ['mcp:read'] });
    const refreshed = await exchange(runtime, {
      grant_type: 'refresh_token',
      client_id: full.clientId,
      refresh_token: full.refresh_token,
      resource,
    });
    expect(tokensSchema.parse(await refreshed.json()).scope).toBe('mcp:read');
  });
});

test('external configuration changes stop issuance and refresh and native handlers reject a stripped external marker', async () => {
  await fixture(async (runtime, db) => {
    const started = await begin(runtime);
    const consent = consentSchema.parse(await started.response.json());
    const approved = await approve(runtime, consent.requestId);
    const code =
      new URL(approved.headers.get('Location') ?? '').searchParams.get(
        'code',
      ) ?? '';
    const grant = {
      grant_type: 'authorization_code',
      client_id: started.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: 'https://client.example/callback',
      resource,
    };
    expect(
      (await exchange(runtime, grant, { 'X-Test-Disable-External': 'true' }))
        .status,
    ).toBe(400);
    const connected = await connect(runtime);
    const principal = principalSchema.parse(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    );
    const props = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      connectionId: principal.connectionId,
      clientId: connected.clientId,
      scopes: principal.scopes,
    };
    const native = await runtime.dispatchFetch(
      `${origin}/__fixture/native-props`,
      { method: 'POST', body: JSON.stringify(props) },
    );
    expect(native.status).toBe(403);
    expect(
      (
        await exchange(
          runtime,
          {
            grant_type: 'refresh_token',
            client_id: connected.clientId,
            refresh_token: connected.refresh_token,
            resource,
          },
          { 'X-Test-Disable-External': 'true' },
        )
      ).status,
    ).toBe(400);
    await db
      .prepare(
        "UPDATE mcp_connection SET external_resource = 'https://engine.example/different/mcp' WHERE id = ?",
      )
      .bind(principal.connectionId)
      .run();
    expect(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    ).toEqual({ active: false });
    expect(
      (
        await exchange(runtime, {
          grant_type: 'refresh_token',
          client_id: connected.clientId,
          refresh_token: connected.refresh_token,
          resource,
        })
      ).status,
    ).toBe(400);
  });
});

test('external authorization rejects arbitrary resources, write scopes, foreign workspaces and consent replay', async () => {
  await fixture(async (runtime) => {
    for (const options of [
      { resource: 'https://unregistered.example/mcp' },
      { resource: `${resource}?extra=1` },
      { scope: 'mcp:read mcp:write' },
      { scope: 'mcp:read mcp:publish' },
      { resource: 'https://foreign.example/mcp' },
    ]) {
      expect(
        (await begin(runtime, options)).response.status,
      ).toBeGreaterThanOrEqual(400);
    }
    const started = await begin(runtime);
    const consent = consentSchema.parse(await started.response.json());
    expect(
      (
        await approve(
          runtime,
          consent.requestId,
          {},
          { Origin: 'https://attacker.example' },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await approve(
          runtime,
          consent.requestId,
          {},
          { 'X-Test-Session': 'other-session' },
        )
      ).status,
    ).toBe(400);
    expect((await approve(runtime, consent.requestId)).status).toBe(302);
    expect((await approve(runtime, consent.requestId)).status).toBe(400);
    const modified = await begin(runtime);
    const modifiedConsent = consentSchema.parse(await modified.response.json());
    expect(
      (
        await approve(runtime, modifiedConsent.requestId, {
          permission: 'publish',
        })
      ).status,
    ).toBe(400);
  });
});

test('external token exchange and refresh cannot escalate resources or scopes; native OAuth remains available', async () => {
  await fixture(async (runtime) => {
    const started = await begin(runtime);
    const consent = consentSchema.parse(await started.response.json());
    const approved = await approve(runtime, consent.requestId);
    const code =
      new URL(approved.headers.get('Location') ?? '').searchParams.get(
        'code',
      ) ?? '';
    const grant = {
      grant_type: 'authorization_code',
      client_id: started.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: 'https://client.example/callback',
    };
    for (const target of [
      `${origin}/mcp`,
      'https://engine.example/other',
      'https://other.example/mcp',
    ]) {
      expect(
        (await exchange(runtime, { ...grant, resource: target })).status,
      ).toBe(400);
    }
    const issued = await exchange(runtime, { ...grant, resource });
    expect(issued.status).toBe(200);
    const tokens = tokensSchema.parse(await issued.json());
    expect(
      (
        await exchange(runtime, {
          grant_type: 'refresh_token',
          client_id: started.clientId,
          refresh_token: tokens.refresh_token,
          resource: `${origin}/mcp`,
        })
      ).status,
    ).toBe(400);
    const refreshed = await exchange(runtime, {
      grant_type: 'refresh_token',
      client_id: started.clientId,
      refresh_token: tokens.refresh_token,
      resource,
      scope: 'mcp:read mcp:write mcp:publish mcp:run',
    });
    expect(refreshed.status).toBe(200);
    expect(tokensSchema.parse(await refreshed.json()).scope).toBe(
      'mcp:read mcp:run',
    );
    const native = await connect(runtime, { native: true });
    expect(native.consent.externalServer).toBeUndefined();
    expect(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: native.access_token,
          resource,
        })
      ).json(),
    ).toEqual({ active: false });
    const response = await runtime.dispatchFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        'X-Test-OAuth': 'true',
        Authorization: `Bearer ${native.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-11-25',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_connection', arguments: {} },
      }),
    });
    expect(response.status).toBe(200);
  });
});

test('bridge rejects forged service and user credentials, cross-server subjects, unapproved tools and foreign content', async () => {
  await fixture(async (runtime) => {
    const connected = await connect(runtime);
    const principal = principalSchema.parse(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    );
    const subject = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      connectionId: principal.connectionId,
    };
    const body = {
      action: 'read',
      subject,
      tool: 'get_prompt',
      arguments: { id: 'prompt', version: { kind: 'draft' } },
    };
    expect(
      (await bridge(runtime, body, { Authorization: 'Bearer forged' })).status,
    ).toBe(401);
    expect((await bridge(runtime, body, { Authorization: '' })).status).toBe(
      401,
    );
    expect(
      (
        await bridge(
          runtime,
          body,
          { Authorization: `Bearer ${servers[1]?.sharedSecret}` },
          'other',
        )
      ).status,
    ).toBe(403);
    for (const replacement of [
      { ...subject, organizationId: 'foreign' },
      { ...subject, userId: 'another-user' },
      { ...subject, connectionId: 'connection-read' },
    ])
      expect(
        (await bridge(runtime, { ...body, subject: replacement })).status,
      ).toBe(403);
    for (const tool of [
      'create_prompt',
      'test_prompt',
      'publish_prompt',
      'search_content',
    ])
      expect((await bridge(runtime, { ...body, tool })).status).toBe(400);
    const foreign = await bridge(runtime, {
      ...body,
      arguments: { id: 'foreign-prompt', version: { kind: 'latest' } },
    });
    const foreignText = await foreign.text();
    expect(foreignText).toContain('content_not_found');
    expect(foreignText).not.toContain('Private foreign');
    for (const token of [
      'invalid-token',
      `${connected.access_token.slice(0, -10)}forgedtext`,
      connected.refresh_token,
    ])
      expect(
        await (
          await bridge(runtime, { action: 'introspect', token, resource })
        ).json(),
      ).toEqual({ active: false });
    expect(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource: 'https://other.example/mcp',
        })
      ).json(),
    ).toEqual({ active: false });
    expect(
      (await bridge(runtime, { ...body, extra: 'x'.repeat(17000) })).status,
    ).toBe(413);
  });
});

test('revocation, membership loss, disabled registration and expired grants terminate delegated access', async () => {
  await fixture(async (runtime, db) => {
    const connected = await connect(runtime);
    const principal = principalSchema.parse(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    );
    const subject = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      connectionId: principal.connectionId,
    };
    const read = {
      action: 'read',
      subject,
      tool: 'get_connection',
      arguments: {},
    };
    expect(
      (await bridge(runtime, read, { 'X-Test-Disable-External': 'true' }))
        .status,
    ).toBe(401);
    expect(
      (
        await exchange(runtime, {
          grant_type: 'refresh_token',
          client_id: connected.clientId,
          refresh_token: connected.refresh_token,
          resource,
        })
      ).status,
    ).toBe(200);
    const grant = await db
      .prepare('SELECT grant_id FROM mcp_connection WHERE id = ?')
      .bind(subject.connectionId)
      .first<{ grant_id: string }>();
    const grantKey = `grant:${subject.userId}:${grant?.grant_id}`;
    const record = z.record(z.string(), z.unknown()).parse(
      await (
        await runtime.dispatchFetch(`${origin}/__fixture/kv`, {
          method: 'POST',
          body: JSON.stringify({ key: grantKey }),
        })
      ).json(),
    );
    await runtime.dispatchFetch(`${origin}/__fixture/kv`, {
      method: 'POST',
      body: JSON.stringify({
        key: grantKey,
        value: JSON.stringify({ ...record, expiresAt: 1 }),
      }),
    });
    expect((await bridge(runtime, read)).status).toBe(403);
    await runtime.dispatchFetch(`${origin}/__fixture/kv`, {
      method: 'POST',
      body: JSON.stringify({ key: grantKey, value: JSON.stringify(record) }),
    });
    await db
      .prepare("UPDATE member SET role = 'invalid' WHERE id = 'member'")
      .run();
    expect((await bridge(runtime, read)).status).toBe(403);
    await db
      .prepare("UPDATE member SET role = 'owner' WHERE id = 'member'")
      .run();
    const revoked = await exchange(runtime, {
      token: connected.access_token,
      client_id: connected.clientId,
    });
    expect(revoked.status).toBe(200);
    expect((await bridge(runtime, read)).status).toBe(403);
    expect(
      await (
        await bridge(runtime, {
          action: 'introspect',
          token: connected.access_token,
          resource,
        })
      ).json(),
    ).toEqual({ active: false });
    expect(
      (
        await exchange(runtime, {
          grant_type: 'refresh_token',
          client_id: connected.clientId,
          refresh_token: connected.refresh_token,
          resource,
        })
      ).status,
    ).toBe(400);
  });
});
