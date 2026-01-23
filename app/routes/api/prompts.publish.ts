import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.publish';

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
  const promptId = formData.get('promptId') as string;
  const version = formData.get('version') as string;

  if (!promptId) {
    return data({ error: 'Missing promptId' }, { status: 400 });
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

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  const currentDraft = await db
    .prepare(
      'SELECT id FROM prompt_version WHERE prompt_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ id: string }>();

  if (!currentDraft) {
    return data({ error: 'No draft version to publish' }, { status: 400 });
  }

  const lastPublished = await db
    .prepare(
      'SELECT major, minor, patch FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
    )
    .bind(promptId)
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
      'UPDATE prompt_version SET major = ?, minor = ?, patch = ?, published_at = ?, published_by = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    )
    .bind(major, minor, patch, now, session.user.id, now, session.user.id, currentDraft.id)
    .run();

  await db
    .prepare('UPDATE prompt SET updated_at = ? WHERE id = ?')
    .bind(Date.now(), promptId)
    .run();

  return { success: true, version: `${major}.${minor}.${patch}` };
};
