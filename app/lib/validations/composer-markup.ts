import { z } from 'zod';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const composerMarkupPartsSchema = z
  .array(
    z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('prompt'),
        promptId: idSchema,
        versionId: idSchema.optional(),
      }),
      z.strictObject({ kind: z.literal('variable'), fieldId: idSchema }),
      z.strictObject({ kind: z.literal('raw_html'), html: z.string() }),
    ]),
  )
  .min(1)
  .max(100);
export type ComposerMarkupParts = z.input<typeof composerMarkupPartsSchema>;
