import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/composers.save-config';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const composerId = formData.get('composerId') as string;
  const configJson = (formData.get('config') as string) ?? '{}';

  if (!composerId) {
    return data({ error: 'Missing composerId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Verify composer ownership
  const composerOwnership = await db
    .prepare(
      'SELECT id FROM composer WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(composerId, org.organizationId)
    .first();

  if (!composerOwnership) {
    return data({ error: 'Composer not found' }, { status: 404 });
  }

  // Get current version (draft-first)
  const currentVersion = await db
    .prepare(
      'SELECT id, published_at, content FROM composer_version WHERE composer_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
    )
    .bind(composerId)
    .first<{
      id: string;
      published_at: number | null;
      content: string | null;
    }>();

  const now = Date.now();

  if (!currentVersion) {
    // No version exists — create new draft
    await db
      .prepare(
        'INSERT INTO composer_version (id, composer_id, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        composerId,
        configJson,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  } else if (currentVersion.published_at === null) {
    // Current is draft — update in place
    await db
      .prepare(
        'UPDATE composer_version SET config = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      )
      .bind(configJson, now, session.user.id, currentVersion.id)
      .run();
  } else {
    // Current is published — create new draft, carry over content
    await db
      .prepare(
        'INSERT INTO composer_version (id, composer_id, config, content, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        composerId,
        configJson,
        currentVersion.content,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  }

  return { success: true, savedAt: now, intent: 'saveConfig' };
};
