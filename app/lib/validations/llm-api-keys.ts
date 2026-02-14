import { z } from 'zod';

export const createLlmApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  provider: z.enum(['openai', 'anthropic', 'google'], {
    message: 'Provider is required',
  }),
  apiKey: z.string().min(1, 'API key is required'),
  enabledModels: z.array(z.string()).min(1, 'Select at least one model'),
});

export type CreateLlmApiKeyInput = z.infer<typeof createLlmApiKeySchema>;

export const deleteLlmApiKeySchema = z.object({
  id: z.string().min(1, 'Key ID is required'),
});
