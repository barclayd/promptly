import { data } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
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

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

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
    // Use userId for server-side creation (allows setting permissions)
    const apiKeyResponse = await auth.api.createApiKey({
      body: {
        name: result.data.name,
        userId: session.user.id,
        permissions,
        metadata: {
          organizationId: org.organizationId,
        },
      },
      asResponse: true,
    });

    if (!apiKeyResponse.ok) {
      const errorData = await apiKeyResponse.json();
      return data(
        { errors: { _form: [(errorData as { message?: string }).message || 'Failed to create API key'] } },
        { status: apiKeyResponse.status },
      );
    }

    const apiKey = await apiKeyResponse.json();

    return data({ success: true, apiKey });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return data(
      { errors: { _form: ['Failed to create API key'] } },
      { status: 500 },
    );
  }
};
