import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { z } from 'zod';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.create';

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

  const auth = getAuth(context);

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
  const orgs = await orgsResponse.json();

  if (!orgs || orgs?.length === 0) {
    await auth.api.createOrganization({
      body: {
        name: `${session.user.name}'s Workspace`,
        slug: nanoid(10),
      },
      headers: request.headers,
      asResponse: true,
    });
  }

  // TODO: Add DB persistence here
  // const prompt = await db.insert(prompts).values(result.data);
  // return redirect(`/prompts/${prompt.id}`);

  return data({ success: true });
};
