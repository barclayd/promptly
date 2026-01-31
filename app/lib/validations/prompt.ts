import { z } from 'zod';

export const updatePromptSchema = z.object({
  promptId: z.string().min(1, 'Prompt ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;

export const deletePromptSchema = z.object({
  promptId: z.string().min(1, 'Prompt ID is required'),
});

export type DeletePromptInput = z.infer<typeof deletePromptSchema>;
