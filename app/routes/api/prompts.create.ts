import { nanoid } from 'nanoid';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.create';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

const createPromptSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  project: z.string().optional(),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    project: formData.get('project') || undefined,
  };

  const result = createPromptSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  // biome-ignore lint/suspicious/noExplicitAny: context not implemented
  const auth = getAuth(context as any);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ errors: { _form: ['Not authenticated'] } }, { status: 401 });
  }

  const orgsResponse = await auth.api.listOrganizations({
    headers: request.headers,
    asResponse: true,
  });
  const orgs = (await orgsResponse.json()) as Organization[];

  let orgId: string;

  if (!orgs || orgs?.length === 0) {
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
  } else {
    orgId = orgs[0].id;
  }

  const db = context.cloudflare.env.promptly;

  let folderId = result.data.project;

  if (!folderId) {
    const existingFolder = await db
      .prepare(
        'SELECT id FROM prompt_folder WHERE organization_id = ? AND name = ?',
      )
      .bind(orgId, 'Untitled')
      .first<{ id: string }>();

    if (existingFolder) {
      folderId = existingFolder.id;
    } else {
      folderId = nanoid();
      await db
        .prepare(
          `INSERT INTO prompt_folder (id, name, organization_id, created_by)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(folderId, 'Untitled', orgId, session.user.id)
        .run();
    }
  }

  const promptId = nanoid();
  await db
    .prepare(
      `INSERT INTO prompt (id, name, description, folder_id, organization_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      promptId,
      result.data.name,
      result.data.description || '',
      folderId,
      orgId,
      session.user.id,
    )
    .run();

  return redirect(`/prompts/${folderId}/${promptId}`);
};
