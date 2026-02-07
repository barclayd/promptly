import { nanoid } from 'nanoid';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { getSubscriptionStatus } from '~/lib/subscription.server';
import type { Route } from './+types/prompts.create';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

const createPromptSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  };

  const result = createPromptSchema.safeParse(rawData);

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

  // Check prompt limit
  const subscription = await getSubscriptionStatus(db, orgId);
  if (subscription.limits.prompts !== -1) {
    const countResult = await db
      .prepare(
        'SELECT COUNT(*) as count FROM prompt WHERE organization_id = ? AND deleted_at IS NULL',
      )
      .bind(orgId)
      .first<{ count: number }>();
    const currentCount = countResult?.count ?? 0;
    if (currentCount >= subscription.limits.prompts) {
      return data(
        {
          limitExceeded: true,
          resource: 'prompts' as const,
          current: currentCount,
          limit: subscription.limits.prompts,
        },
        { status: 403 },
      );
    }
  }

  let folderId: string | undefined;

  {
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

  // Create initial draft version
  const versionId = nanoid();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO prompt_version (id, prompt_id, system_message, user_message, config, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      versionId,
      promptId,
      '',
      '',
      '{}',
      session.user.id,
      now,
      session.user.id,
    )
    .run();

  return redirect(`/prompts/${promptId}`);
};
