import { z } from 'zod';

export const updateSnippetSchema = z.object({
  snippetId: z.string().min(1, 'Snippet ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;

export const deleteSnippetSchema = z.object({
  snippetId: z.string().min(1, 'Snippet ID is required'),
});
export type DeleteSnippetInput = z.infer<typeof deleteSnippetSchema>;
