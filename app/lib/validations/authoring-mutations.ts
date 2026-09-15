import { z } from 'zod';
import {
  composerAuthoringEditSchema,
  composerSubmittedDefinitionSchema,
  promptAuthoringEditSchema,
  promptSubmittedDefinitionSchema,
} from './authoring';

const requestKey = z.string().min(1).max(256);
const id = z.string().min(1).max(128);
const folderId = id.nullable().optional();
const addressedMutation = { id, expectedRevision: id, requestKey };

export const createPromptAuthoringSchema = z.strictObject({
  requestKey,
  definition: promptSubmittedDefinitionSchema,
  folderId,
});
export type CreatePromptAuthoringInput = z.input<
  typeof createPromptAuthoringSchema
>;

export const createComposerAuthoringSchema = z.strictObject({
  requestKey,
  definition: composerSubmittedDefinitionSchema,
  folderId,
});
export type CreateComposerAuthoringInput = z.input<
  typeof createComposerAuthoringSchema
>;

export const updatePromptAuthoringSchema = z.strictObject({
  ...addressedMutation,
  edit: promptAuthoringEditSchema,
  folderId,
});
export type UpdatePromptAuthoringInput = z.input<
  typeof updatePromptAuthoringSchema
>;

export const updateComposerAuthoringSchema = z.strictObject({
  ...addressedMutation,
  edit: composerAuthoringEditSchema,
  folderId,
});
export type UpdateComposerAuthoringInput = z.input<
  typeof updateComposerAuthoringSchema
>;

export const publishAuthoringSchema = z.strictObject({
  ...addressedMutation,
  version: z.string().max(100).optional(),
});
export type PublishAuthoringInput = z.input<typeof publishAuthoringSchema>;

export const deleteAuthoringSchema = z.strictObject(addressedMutation);
export type DeleteAuthoringInput = z.input<typeof deleteAuthoringSchema>;

export const restoreAuthoringChangeSchema = z.strictObject({
  ...addressedMutation,
  kind: z.enum(['prompt', 'composer']),
  changeId: id,
  phase: z.enum(['before', 'after']),
});
export type RestoreAuthoringChangeInput = z.input<
  typeof restoreAuthoringChangeSchema
>;
