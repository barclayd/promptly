import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import {
  extractPromptIds,
  extractPromptVersionPins,
} from '~/lib/composer-content-parser';
import { syncComposerPromptRefs } from '~/lib/composer-junction-sync.server';
import type { Route } from './+types/composers.save-content';

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
  const content = (formData.get('content') as string)?.trim() ?? '';

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
      'SELECT id, published_at, config FROM composer_version WHERE composer_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
    )
    .bind(composerId)
    .first<{
      id: string;
      published_at: number | null;
      config: string | null;
    }>();

  const now = Date.now();
  let versionId: string;

  if (!currentVersion) {
    // No version exists — create new draft
    versionId = nanoid();
    await db
      .prepare(
        'INSERT INTO composer_version (id, composer_id, content, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        versionId,
        composerId,
        content,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  } else if (currentVersion.published_at === null) {
    // Current is draft — update in place
    versionId = currentVersion.id;
    await db
      .prepare(
        'UPDATE composer_version SET content = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      )
      .bind(content, now, session.user.id, currentVersion.id)
      .run();
  } else {
    // Current is published — create new draft, carry over config
    versionId = nanoid();
    await db
      .prepare(
        'INSERT INTO composer_version (id, composer_id, content, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        versionId,
        composerId,
        content,
        currentVersion.config ?? '{}',
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  }

  // Parse prompt refs and version pins from content, sync junction table
  const promptIds = extractPromptIds(content);
  const versionPins = extractPromptVersionPins(content);
  await syncComposerPromptRefs(db, versionId, promptIds, versionPins);

  return { success: true, savedAt: now };
};
