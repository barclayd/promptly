import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { sessionContext } from '~/context';
import type { Route } from './+types/user-state.update';

// Allowlisted key prefixes — only these can be written
const ALLOWED_PREFIXES = [
  'onboarding-completed',
  'onboarding-skipped',
  'trial-expired-modal-shown:',
  'winback-show-count:',
  'winback-dismissed:',
  'mid-trial-nudge-dismissed:',
  'usage-threshold-dismissed:prompts:',
  'usage-threshold-dismissed:team:',
  'usage-threshold-dismissed:api-calls:',
];

const isKeyAllowed = (key: string): boolean =>
  ALLOWED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = context.get(sessionContext);
  const userId = session?.user?.id;

  if (!userId) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { key, value = '1' } = body as { key?: string; value?: string };

  if (!key || typeof key !== 'string') {
    return data({ error: 'Missing key' }, { status: 400 });
  }

  if (!isKeyAllowed(key)) {
    return data({ error: 'Key not allowed' }, { status: 403 });
  }

  const db = context.cloudflare.env.promptly;
  const id = nanoid();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO user_state (id, user_id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(id, userId, key, String(value), now, now)
    .run();

  return data({ ok: true });
};
