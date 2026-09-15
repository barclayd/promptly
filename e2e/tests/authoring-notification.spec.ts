import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { expect, test } from '../fixtures/base';

test('saved revision notifications use binding RPC and cannot be forged through the editor socket', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'promptly-notification-'));
  let runtime: Miniflare | undefined;
  try {
    const scriptPath = join(temporary, 'worker.js');
    execFileSync(
      'bun',
      [
        'build',
        fileURLToPath(
          new URL(
            '../fixtures/presence-notification-worker.ts',
            import.meta.url,
          ),
        ),
        '--target=browser',
        '--external=cloudflare:*',
        '--outfile',
        scriptPath,
      ],
      { stdio: 'pipe' },
    );
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        name: 'promptly-presence-notification-test',
        modules: true,
        script: await readFile(scriptPath, 'utf8'),
        compatibilityDate: '2025-10-08',
        compatibilityFlags: ['nodejs_compat_v2'],
        durableObjects: {
          PRESENCE_ROOM: { className: 'PresenceRoom', useSQLite: true },
        },
      }),
    );
    const response = await runtime.dispatchFetch(
      'https://presence.test/?userId=user&userName=User&userEmail=user%40example.com',
      { headers: { Upgrade: 'websocket' } },
    );
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (!socket) throw new Error('Expected an editor socket');
    socket.accept();
    const messages: unknown[] = [];
    let resolvePong: () => void = () => {};
    let resolveNotice: () => void = () => {};
    const pong = new Promise<void>((resolve) => {
      resolvePong = resolve;
    });
    const notice = new Promise<void>((resolve) => {
      resolveNotice = resolve;
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      messages.push(message);
      if (message.type === 'pong') resolvePong();
      if (message.type === 'saved_revision') resolveNotice();
    });
    socket.send(JSON.stringify({ type: 'saved_revision', revision: 'forged' }));
    socket.send(JSON.stringify({ type: 'ping' }));
    await pong;
    expect(messages).toEqual([{ type: 'pong' }]);
    expect(
      (await runtime.dispatchFetch('https://presence.test/notify')).status,
    ).toBe(204);
    await notice;
    expect(messages[1]).toEqual({
      type: 'saved_revision',
      documentId: 'notification-document',
      kind: 'prompt',
      revision: 'saved-revision',
      changeId: 'change',
    });
    socket.close();
  } finally {
    await runtime?.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});
