import { nanoid } from 'nanoid';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { authContext, orgContext, sessionContext } from '~/context';
import { createComposerSchema } from '~/lib/validations/composer';
import type { Route } from './+types/composers.create';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  };

  const result = createComposerSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = context.get(authContext);
  const session = context.get(sessionContext);

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
        'SELECT id FROM composer_folder WHERE organization_id = ? AND name = ?',
      )
      .bind(orgId, 'Untitled')
      .first<{ id: string }>();

    if (existingFolder) {
      folderId = existingFolder.id;
    } else {
      folderId = nanoid();
      await db
        .prepare(
          `INSERT INTO composer_folder (id, name, organization_id, created_by)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(folderId, 'Untitled', orgId, session.user.id)
        .run();
    }
  }

  const composerId = nanoid();
  await db
    .prepare(
      `INSERT INTO composer (id, name, description, folder_id, organization_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      composerId,
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
      `INSERT INTO composer_version (id, composer_id, content, config, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      versionId,
      composerId,
      '',
      '{}',
      session.user.id,
      now,
      session.user.id,
    )
    .run();

  return redirect(`/composers/${composerId}`);
};
