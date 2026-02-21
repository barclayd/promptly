import { z } from 'zod';

export const createComposerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
export type CreateComposerInput = z.infer<typeof createComposerSchema>;

export const updateComposerSchema = z.object({
  composerId: z.string().min(1, 'Composer ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
export type UpdateComposerInput = z.infer<typeof updateComposerSchema>;

export const deleteComposerSchema = z.object({
  composerId: z.string().min(1, 'Composer ID is required'),
});
export type DeleteComposerInput = z.infer<typeof deleteComposerSchema>;
