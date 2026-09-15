import { z } from 'zod';
import { authoringPageSchema, authoringSemverSchema } from './authoring';

const idSchema = z.string().min(1).max(200);
export const authoringHistoryKindSchema = z.enum(['prompt', 'composer']);
export type AuthoringHistoryKind = z.infer<typeof authoringHistoryKindSchema>;

export const authoringHistoryListInputSchema = z
  .strictObject({
    kind: authoringHistoryKindSchema.optional(),
    id: idSchema.optional(),
    ...authoringPageSchema.shape,
  })
  .refine((value) => value.id === undefined || value.kind !== undefined, {
    message: 'A document kind is required when selecting a document.',
    path: ['kind'],
  });
export type AuthoringHistoryListInput = z.input<
  typeof authoringHistoryListInputSchema
>;

export const authoringChangeInputSchema = z.strictObject({
  changeId: idSchema,
});
export type AuthoringChangeInput = z.input<typeof authoringChangeInputSchema>;

export const authoringAfterSnapshotInputSchema = z.union([
  z.strictObject({
    kind: authoringHistoryKindSchema,
    id: idSchema,
    changeId: idSchema,
    revision: idSchema.optional(),
  }),
  z.strictObject({
    kind: authoringHistoryKindSchema,
    id: idSchema,
    revision: idSchema,
  }),
]);
export type AuthoringAfterSnapshotInput = z.input<
  typeof authoringAfterSnapshotInputSchema
>;

export const authoringStoredVersionSchema = z
  .strictObject({
    id: idSchema,
    status: z.enum(['draft', 'published']),
    version: authoringSemverSchema.nullable(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative().nullable(),
    publishedAt: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (value) =>
      value.status === 'draft'
        ? value.version === null && value.publishedAt === null
        : value.version !== null && value.publishedAt !== null,
    'Stored version publication metadata is inconsistent.',
  );
export type AuthoringStoredVersion = z.infer<
  typeof authoringStoredVersionSchema
>;

export const authoringStoredSnapshotSchema = z.strictObject({
  definition: z.unknown(),
  folderId: idSchema.nullable(),
  version: authoringStoredVersionSchema,
});
export type AuthoringStoredSnapshot = z.infer<
  typeof authoringStoredSnapshotSchema
>;
