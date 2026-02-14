import type { LlmApiKey } from './llm-api-key-types';

type D1Row = {
  id: string;
  organization_id: string;
  name: string;
  provider: string;
  key_hint: string;
  enabled_models: string;
  created_by: string;
  created_at: number;
  updated_at: number;
};

const rowToLlmApiKey = (row: D1Row): LlmApiKey => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  provider: row.provider as LlmApiKey['provider'],
  keyHint: row.key_hint,
  enabledModels: JSON.parse(row.enabled_models) as string[],
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getLlmApiKeysForOrg = async (
  db: D1Database,
  organizationId: string,
): Promise<LlmApiKey[]> => {
  const result = await db
    .prepare(
      'SELECT id, organization_id, name, provider, key_hint, enabled_models, created_by, created_at, updated_at FROM llm_api_key WHERE organization_id = ? ORDER BY created_at DESC',
    )
    .bind(organizationId)
    .all<D1Row>();

  return result.results.map(rowToLlmApiKey);
};

export const getEnabledModelsForOrg = async (
  db: D1Database,
  organizationId: string,
): Promise<string[]> => {
  const result = await db
    .prepare('SELECT enabled_models FROM llm_api_key WHERE organization_id = ?')
    .bind(organizationId)
    .all<{ enabled_models: string }>();

  const modelSet = new Set<string>();
  for (const row of result.results) {
    const models = JSON.parse(row.enabled_models) as string[];
    for (const model of models) {
      modelSet.add(model);
    }
  }

  return [...modelSet];
};

export const getLlmApiKeyForModel = async (
  db: D1Database,
  organizationId: string,
  modelId: string,
): Promise<{ encryptedKey: string } | null> => {
  // SQLite json_each to search within the JSON array
  const result = await db
    .prepare(
      `SELECT encrypted_key FROM llm_api_key
       WHERE organization_id = ?
       AND EXISTS (
         SELECT 1 FROM json_each(enabled_models) WHERE value = ?
       )
       LIMIT 1`,
    )
    .bind(organizationId, modelId)
    .first<{ encrypted_key: string }>();

  if (!result) return null;

  return { encryptedKey: result.encrypted_key };
};
