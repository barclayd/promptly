import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import {
  getAuthorizedPresenceDocument,
  getPresenceDocumentId,
  isTrustedPresenceOrigin,
} from '../../app/lib/presence-auth.server';
import { expect, test } from '../fixtures/base';
import { TEST_USER } from '../helpers/test-data';

const withDatabase = async (run: (db: D1Database) => Promise<void>) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch: () => new Response("Presence test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
      '0002_prompt_table.sql',
      '0018_add_snippet_tables.sql',
      '0019_add_composer_tables.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      const statements = sql
        .replaceAll('--> statement-breakpoint', '')
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);
      await db.batch(statements.map((statement) => db.prepare(statement)));
    }
    await db.batch([
      db.prepare(`INSERT INTO user (id, name, email) VALUES
        ('member', 'Member', 'member@example.com'),
        ('admin', 'Admin', 'admin@example.com'),
        ('owner', 'Owner', 'owner@example.com'),
        ('outsider', 'Outsider', 'outsider@example.com')`),
      db.prepare(`INSERT INTO organization (id, name, slug, created_at) VALUES
        ('workspace', 'Workspace', 'workspace', 1),
        ('other-workspace', 'Other Workspace', 'other-workspace', 1)`),
      db.prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at) VALUES
        ('member-membership', 'member', 'workspace', 'member', 1),
        ('admin-membership', 'admin', 'workspace', 'admin', 1),
        ('owner-membership', 'owner', 'workspace', 'owner', 1),
        ('outsider-membership', 'outsider', 'other-workspace', 'owner', 1)`),
      db.prepare(`INSERT INTO prompt (id, name, organization_id, created_by, deleted_at) VALUES
        ('prompt-doc', 'Prompt', 'workspace', 'owner', NULL),
        ('deleted-prompt', 'Deleted prompt', 'workspace', 'owner', 1)`),
      db.prepare(`INSERT INTO composer (id, name, organization_id, created_by, deleted_at) VALUES
        ('composer-doc', 'Composer', 'workspace', 'owner', NULL),
        ('deleted-composer', 'Deleted composer', 'workspace', 'owner', 1)`),
      db.prepare(`INSERT INTO snippet (id, name, organization_id, created_by, deleted_at) VALUES
        ('snippet-doc', 'Snippet', 'workspace', 'owner', NULL),
        ('deleted-snippet', 'Deleted snippet', 'workspace', 'owner', 1)`),
    ]);
    await run(db);
  } finally {
    await runtime.dispose();
  }
};

test('presence permits current workspace members for prompts, composers, and snippets', async () => {
  await withDatabase(async (db) => {
    for (const userId of ['member', 'admin', 'owner']) {
      for (const kind of ['prompt', 'composer', 'snippet']) {
        const id = `${kind}-doc`;
        expect(await getAuthorizedPresenceDocument(db, userId, id)).toEqual({
          id,
          organizationId: 'workspace',
          kind,
        });
      }
    }
  });
});

test('presence refuses outsiders, deleted documents, missing documents, and missing users', async () => {
  await withDatabase(async (db) => {
    for (const kind of ['prompt', 'composer', 'snippet']) {
      expect(
        await getAuthorizedPresenceDocument(db, 'outsider', `${kind}-doc`),
      ).toBeNull();
      expect(
        await getAuthorizedPresenceDocument(db, 'member', `deleted-${kind}`),
      ).toBeNull();
      expect(
        await getAuthorizedPresenceDocument(db, 'missing-user', `${kind}-doc`),
      ).toBeNull();
    }
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'missing-document'),
    ).toBeNull();
    expect(
      await getAuthorizedPresenceDocument(db, 'member', "' OR 1 = 1 --"),
    ).toBeNull();
  });
});

test('presence checks live membership again when a user reconnects', async () => {
  await withDatabase(async (db) => {
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'prompt-doc'),
    ).not.toBeNull();
    await db.prepare("DELETE FROM member WHERE id = 'member-membership'").run();
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'prompt-doc'),
    ).toBeNull();
    await db
      .prepare(`INSERT INTO member (id, user_id, organization_id, role, created_at)
        VALUES ('different-membership', 'member', 'other-workspace', 'owner', 2)`)
      .run();
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'prompt-doc'),
    ).toBeNull();
  });
});

test('presence refuses ambiguous room IDs across document types including deleted documents', async () => {
  await withDatabase(async (db) => {
    await db
      .prepare(`INSERT INTO composer (id, name, organization_id, created_by)
        VALUES ('prompt-doc', 'Colliding composer', 'other-workspace', 'outsider')`)
      .run();
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'prompt-doc'),
    ).toBeNull();
    expect(
      await getAuthorizedPresenceDocument(db, 'outsider', 'prompt-doc'),
    ).toBeNull();
    await db
      .prepare("UPDATE composer SET deleted_at = 1 WHERE id = 'prompt-doc'")
      .run();
    expect(
      await getAuthorizedPresenceDocument(db, 'member', 'prompt-doc'),
    ).toBeNull();
  });
});

test('presence accepts only the configured app Origin and exact document paths', () => {
  const applicationUrl = 'https://app.promptlycms.com';
  for (const origin of [
    undefined,
    'null',
    'https://evil.example',
    'https://app.promptlycms.com.evil.example',
    'https://app.promptlycms.com@evil.example',
    'http://app.promptlycms.com',
    'https://app.promptlycms.com:444',
    'https://app.promptlycms.com/path',
    'https://app.promptlycms.com https://evil.example',
  ]) {
    const headers = new Headers({
      'X-Forwarded-Host': 'app.promptlycms.com',
    });
    if (origin !== undefined) headers.set('Origin', origin);
    expect(
      isTrustedPresenceOrigin(
        new Request(`${applicationUrl}/api/presence/document`, { headers }),
        applicationUrl,
      ),
    ).toBe(false);
  }
  for (const trusted of [applicationUrl, 'http://localhost:5173']) {
    const request = new Request(`${trusted}/api/presence/document`, {
      headers: { Origin: trusted },
    });
    expect(isTrustedPresenceOrigin(request, trusted)).toBe(true);
    expect(isTrustedPresenceOrigin(request, 'invalid-url')).toBe(false);
  }
  expect(getPresenceDocumentId('/api/presence/document_Id-1')).toBe(
    'document_Id-1',
  );
  for (const path of [
    '/api/presence/',
    '/api/presence/document/extra',
    '/api/presence/document/',
    '/api/presence/%64ocument',
    '/api/presence/document%2Fother',
    '/api/presence/../document',
    `/api/presence/${'a'.repeat(129)}`,
  ]) {
    expect(getPresenceDocumentId(path)).toBeNull();
  }
});

test('presence rejects untrusted upgrade requests before joining a room', async ({
  request,
  authenticatedPage,
}) => {
  const path = '/api/presence/missing-document';
  const missingOrigin = await authenticatedPage.request.get(path, {
    headers: { Upgrade: 'websocket' },
  });
  expect(missingOrigin.status()).toBe(403);
  const maliciousOrigin = await authenticatedPage.request.get(path, {
    headers: { Upgrade: 'websocket', Origin: 'https://evil.example' },
  });
  expect(maliciousOrigin.status()).toBe(403);
  const unauthenticated = await request.get(path, {
    headers: { Upgrade: 'websocket', Origin: 'http://localhost:5173' },
  });
  expect(unauthenticated.status()).toBe(401);
  const missingDocument = await authenticatedPage.request.get(path, {
    headers: { Upgrade: 'websocket', Origin: 'http://localhost:5173' },
  });
  expect(missingDocument.status()).toBe(404);
});

test('presence upgrades authenticated collaborators for every editor and ignores spoofed identity', async ({
  authenticatedPage: page,
}) => {
  for (const kind of ['prompt', 'composer', 'snippet']) {
    const response = await page.request.post(`/api/${kind}s/create`, {
      form: {
        name: `Presence ${kind} ${randomUUID()}`,
        ...(kind === 'snippet' ? {} : { requestKey: randomUUID() }),
      },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    const redirectLocation = response.headers().location;
    expect(redirectLocation).toMatch(new RegExp(`^/${kind}s/[^/]+$`));
    const documentId = redirectLocation.split('/').at(-1) ?? '';
    try {
      const result = await page.evaluate(
        ({ id, email }) =>
          new Promise<{ connected: boolean; trustedIdentity: boolean }>(
            (resolve) => {
              const url = new URL(
                `/api/presence/${id}`,
                window.location.origin,
              );
              url.protocol =
                window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              url.searchParams.set('userId', 'spoofed-user');
              url.searchParams.set('userEmail', 'spoofed@example.com');
              const socket = new WebSocket(url);
              const finish = (connected: boolean, trustedIdentity = false) => {
                clearTimeout(timeout);
                socket.close();
                resolve({ connected, trustedIdentity });
              };
              const timeout = setTimeout(() => finish(false), 10_000);
              socket.onopen = () =>
                socket.send(JSON.stringify({ type: 'init' }));
              socket.onerror = () => finish(false);
              socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'presence') {
                  finish(
                    true,
                    data.users.some(
                      (user: { id: string; email: string }) =>
                        user.email === email && user.id !== 'spoofed-user',
                    ) &&
                      !data.users.some(
                        (user: { id: string }) => user.id === 'spoofed-user',
                      ),
                  );
                }
              };
            },
          ),
        { id: documentId, email: TEST_USER.email },
      );
      expect(result, `${kind} editor presence`).toEqual({
        connected: true,
        trustedIdentity: true,
      });
    } finally {
      const form: Record<string, string> = { [`${kind}Id`]: documentId };
      if (kind !== 'snippet') {
        const current = await page.request.get(
          `/api/authoring/read?kind=${kind}&id=${documentId}`,
        );
        expect(current.ok()).toBe(true);
        const document = (await current.json()) as { revision: string };
        form.expectedRevision = document.revision;
        form.requestKey = randomUUID();
      }
      const deleted = await page.request.post(`/api/${kind}s/delete`, { form });
      expect(deleted.ok()).toBe(true);
    }
  }
});
