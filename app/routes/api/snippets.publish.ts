import { data } from 'react-router';
import { cloudflareContext, orgContext, sessionContext } from '~/context';
import { AuthoringError } from '~/lib/authoring/types';
import { publishSnippetDraft } from '~/lib/snippet-drafts.server';
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

  const db = context.get(cloudflareContext).env.promptly;

  try {
    const published = await publishSnippetDraft(db, {
      snippetId,
      organizationId: org.organizationId,
      userId: session.user.id,
      major,
      minor,
      patch,
    });
    return { success: true, version: published.version };
  } catch (error) {
    if (!(error instanceof AuthoringError)) throw error;
    return data(
      { error: error.message },
      { status: error.code === 'content_not_found' ? 404 : 400 },
    );
  }
};
