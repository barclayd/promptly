import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { decryptApiKey } from '~/lib/encryption.server';
import { getLlmApiKeyForModel } from '~/lib/llm-api-keys.server';
import { createModelInstance } from '~/lib/model-dispatch.server';
import { getProviderFromModelId } from '~/lib/model-pricing';

type ResolveModelSuccess = {
  ok: true;
  model: LanguageModel;
};

type ResolveModelError = {
  ok: false;
  error: string;
  errorType?: string;
  status: number;
};

type ResolveModelResult = ResolveModelSuccess | ResolveModelError;

export const resolveModelForOrg = async ({
  db,
  organizationId,
  modelId,
  encryptionKey,
  systemAnthropicKey,
}: {
  db: D1Database;
  organizationId: string;
  modelId: string;
  encryptionKey: string | undefined;
  systemAnthropicKey: string | undefined;
}): Promise<ResolveModelResult> => {
  // Try org's own LLM API key first
  const orgKey = await getLlmApiKeyForModel(db, organizationId, modelId);

  if (orgKey) {
    if (!encryptionKey) {
      console.error(
        'API_KEY_ENCRYPTION_KEY environment variable is not configured',
      );
      return { ok: false, error: 'Server configuration error', status: 500 };
    }
    try {
      const apiKey = await decryptApiKey(orgKey.encryptedKey, encryptionKey);
      const provider = getProviderFromModelId(modelId);
      const model = createModelInstance(modelId, apiKey, provider);
      return { ok: true, model };
    } catch (err) {
      console.error('Failed to decrypt/create model:', err);
      return {
        ok: false,
        error: 'Failed to initialize model with stored API key',
        errorType: 'AUTH_ERROR',
        status: 500,
      };
    }
  }

  // Fallback: use system Anthropic key for onboarding / default
  if (systemAnthropicKey) {
    const anthropic = createAnthropic({ apiKey: systemAnthropicKey });
    return { ok: true, model: anthropic('claude-haiku-4-5-20251001') };
  }

  return {
    ok: false,
    error: 'No API key configured for this model',
    errorType: 'NO_API_KEY',
    status: 400,
  };
};
