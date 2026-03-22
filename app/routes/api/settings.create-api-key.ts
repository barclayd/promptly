import { data } from 'react-router';
import { z } from 'zod';
import { authContext, orgContext, sessionContext } from '~/context';
import { createApiKeySchema } from '~/lib/validations/settings';
import type { Route } from './+types/settings.create-api-key';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    scopes: formData.getAll('scopes'),
  };

  const result = createApiKeySchema.safeParse(rawData);

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

  if (!org) {
    return data(
      { errors: { _form: ['Organization not found'] } },
      { status: 400 },
    );
  }

  // Convert scopes to permissions format
  // e.g., ['prompt:read'] -> { prompt: ['read'] }
  const permissions: Record<string, string[]> = {};
  for (const scope of result.data.scopes) {
    const [resource, action] = scope.split(':');
    if (resource && action) {
      if (!permissions[resource]) {
        permissions[resource] = [];
      }
      permissions[resource].push(action);
    }
  }

  try {
    const apiKey = await auth.api.createApiKey({
      body: {
        name: result.data.name,
        organizationId: org.organizationId,
        userId: session.user.id,
        permissions,
        metadata: {
          organizationId: org.organizationId,
        },
      },
    });

    return data({ success: true, apiKey });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create API key';
    console.error('Failed to create API key:', message, error);
    return data({ errors: { _form: [message] } }, { status: 500 });
  }
};
