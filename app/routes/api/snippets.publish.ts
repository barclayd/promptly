import { data } from 'react-router';
import { orgContext, sessionContext } from '~/context';
import type { Route } from './+types/snippets.publish';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const session = context.get(sessionContext);

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const snippetId = formData.get('snippetId') as string;
  const version = formData.get('version') as string;

  if (!snippetId) {
    return data({ error: 'Missing snippetId' }, { status: 400 });
  }

  const versionMatch = version?.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!versionMatch) {
    return data(
      { error: 'Invalid version format (expected X.X.X)' },
      { status: 400 },
    );
  }

  const major = Number.parseInt(versionMatch[1], 10);
  const minor = Number.parseInt(versionMatch[2], 10);
  const patch = Number.parseInt(versionMatch[3], 10);

  const db = context.cloudflare.env.promptly;

  const snippetOwnership = await db
    .prepare('SELECT id FROM snippet WHERE id = ? AND organization_id = ?')
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippetOwnership) {
    return data({ error: 'Snippet not found' }, { status: 404 });
  }

  const currentDraft = await db
    .prepare(
      'SELECT id FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
    )
    .bind(snippetId)
    .first<{ id: string }>();

  if (!currentDraft) {
    return data({ error: 'No draft version to publish' }, { status: 400 });
  }

  const lastPublished = await db
    .prepare(
      'SELECT major, minor, patch FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
    )
    .bind(snippetId)
    .first<{ major: number; minor: number; patch: number }>();

  // Compare semver: new version must be greater than last published
  if (lastPublished) {
    const isGreater =
      major > lastPublished.major ||
      (major === lastPublished.major && minor > lastPublished.minor) ||
      (major === lastPublished.major &&
        minor === lastPublished.minor &&
        patch > lastPublished.patch);

    if (!isGreater) {
      return data(
        {
          error: `Version must be greater than ${lastPublished.major}.${lastPublished.minor}.${lastPublished.patch}`,
        },
        { status: 400 },
      );
    }
  }

  const now = Date.now();
  await db
    .prepare(
      'UPDATE snippet_version SET major = ?, minor = ?, patch = ?, published_at = ?, published_by = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    )
    .bind(
      major,
      minor,
      patch,
      now,
      session.user.id,
      now,
      session.user.id,
      currentDraft.id,
    )
    .run();

  await db
    .prepare('UPDATE snippet SET updated_at = ? WHERE id = ?')
    .bind(Date.now(), snippetId)
    .run();

  return { success: true, version: `${major}.${minor}.${patch}` };
};
