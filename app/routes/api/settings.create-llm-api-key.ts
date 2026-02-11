import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { encryptApiKey, getKeyHint } from '~/lib/encryption.server';
import { createLlmApiKeySchema } from '~/lib/validations/llm-api-keys';
import type { Route } from './+types/settings.create-llm-api-key';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    provider: formData.get('provider'),
    apiKey: formData.get('apiKey'),
    enabledModels: JSON.parse(
      (formData.get('enabledModels') as string) || '[]',
    ),
  };

  const result = createLlmApiKeySchema.safeParse(rawData);

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

  // Check user is admin or owner
  const db = context.cloudflare.env.promptly;
  const member = await db
    .prepare(
      'SELECT role FROM member WHERE user_id = ? AND organization_id = ?',
    )
    .bind(session.user.id, org.organizationId)
    .first<{ role: string }>();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return data(
      { errors: { _form: ['Only admins can manage LLM API keys'] } },
      { status: 403 },
    );
  }

  try {
    const encryptionKey = context.cloudflare.env.API_KEY_ENCRYPTION_KEY;
    const encryptedKey = await encryptApiKey(result.data.apiKey, encryptionKey);
    const keyHint = getKeyHint(result.data.apiKey);
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO llm_api_key (id, organization_id, name, provider, encrypted_key, key_hint, enabled_models, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        nanoid(),
        org.organizationId,
        result.data.name,
        result.data.provider,
        encryptedKey,
        keyHint,
        JSON.stringify(result.data.enabledModels),
        session.user.id,
        now,
        now,
      )
      .run();

    return data({ success: true });
  } catch (error) {
    console.error('Failed to create LLM API key:', error);
    return data(
      { errors: { _form: ['Failed to create LLM API key'] } },
      { status: 500 },
    );
  }
};
