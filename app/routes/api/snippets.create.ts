import { nanoid } from 'nanoid';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippets.create';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

const createSnippetSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  };

  const result = createSnippetSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ errors: { _form: ['Not authenticated'] } }, { status: 401 });
  }

  const org = context.get(orgContext);
  let orgId: string;

  if (org) {
    orgId = org.organizationId;
  } else {
    const createOrgResponse = await auth.api.createOrganization({
      body: {
        name: `${session.user.name}'s Workspace`,
        slug: nanoid(10),
      },
      headers: request.headers,
      asResponse: true,
    });
    const newOrg = (await createOrgResponse.json()) as Organization;
    orgId = newOrg.id;
  }

  const db = context.cloudflare.env.promptly;

  let folderId: string | undefined;

  {
    const existingFolder = await db
      .prepare(
        'SELECT id FROM snippet_folder WHERE organization_id = ? AND name = ?',
      )
      .bind(orgId, 'Untitled')
      .first<{ id: string }>();

    if (existingFolder) {
      folderId = existingFolder.id;
    } else {
      folderId = nanoid();
      await db
        .prepare(
          `INSERT INTO snippet_folder (id, name, organization_id, created_by)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(folderId, 'Untitled', orgId, session.user.id)
        .run();
    }
  }

  const snippetId = nanoid();
  await db
    .prepare(
      `INSERT INTO snippet (id, name, description, folder_id, organization_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      snippetId,
      result.data.name,
      result.data.description || '',
      folderId,
      orgId,
      session.user.id,
    )
    .run();

  // Create initial draft version
  const versionId = nanoid();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO snippet_version (id, snippet_id, content, config, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(versionId, snippetId, '', '{}', session.user.id, now, session.user.id)
    .run();

  return redirect(`/snippets/${snippetId}`);
};
