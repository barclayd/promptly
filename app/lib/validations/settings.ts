import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const deleteApiKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required'),
});

export type DeleteApiKeyInput = z.infer<typeof deleteApiKeySchema>;

export const scopeLabels: Record<string, string> = {
  'prompt:read': 'Read Prompts',
};

export const scopeDescriptions: Record<string, string> = {
  'prompt:read': 'Read access to published prompts via API',
};

export const availableScopes = Object.keys(scopeLabels);
