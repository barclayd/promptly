import { z } from 'zod';
import { cloudflareContext, orgContext, sessionContext } from '~/context';
import { AuthoringError } from '~/lib/authoring/types';
import { discardSnippetDraft } from '~/lib/snippet-drafts.server';
import { deleteSnippetSchema } from '~/lib/validations/snippet';
import type { Route } from './+types/snippets.discard';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  const session = context.get(sessionContext);
  if (!org || !session?.user)
    return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const formData = await request.formData();
  const result = deleteSnippetSchema.safeParse({
    snippetId: formData.get('snippetId'),
  });
  if (!result.success)
    return Response.json(
      { error: z.flattenError(result.error).fieldErrors.snippetId?.[0] },
      { status: 400 },
    );

  try {
    await discardSnippetDraft(context.get(cloudflareContext).env.promptly, {
      snippetId: result.data.snippetId,
      organizationId: org.organizationId,
      userId: session.user.id,
    });
    return Response.json({ success: true });
  } catch (error) {
    if (!(error instanceof AuthoringError)) throw error;
    return Response.json(
      { error: error.message },
      { status: error.code === 'content_not_found' ? 404 : 400 },
    );
  }
};
