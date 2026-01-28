import { data, redirect } from 'react-router';
import { z } from 'zod';
import { getAuth } from '~/lib/auth.server';
import { deleteApiKeySchema } from '~/lib/validations/settings';
import type { Route } from './+types/settings.delete-api-key';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    keyId: formData.get('keyId'),
  };

  const result = deleteApiKeySchema.safeParse(rawData);

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

  try {
    const deleteResponse = await auth.api.deleteApiKey({
      body: {
        keyId: result.data.keyId,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      return data(
        {
          errors: {
            _form: [
              (errorData as { message?: string }).message ||
                'Failed to delete API key',
            ],
          },
        },
        { status: deleteResponse.status },
      );
    }

    return redirect('/settings');
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return data(
      { errors: { _form: ['Failed to delete API key'] } },
      { status: 500 },
    );
  }
};
