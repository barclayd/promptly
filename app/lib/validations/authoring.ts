import { z } from 'zod';
import type { SchemaField, ValidationRule } from '../schema-types';

export const AUTHORING_LIMITS = {
  definitionBytes: 524_288,
  contentBytes: 262_144,
  configBytes: 262_144,
  sampleBytes: 262_144,
  schemaFields: 200,
  validationsPerField: 32,
  references: 100,
  jsonDepth: 32,
  jsonNodes: 50_000,
} as const;

const idSchema = z.string().min(1).max(200);
const shortTextSchema = z.string().max(4000);
const jsonSchema: z.ZodType<z.infer<ReturnType<typeof z.json>>> = z.json();
const byteLimitedText = (maximum: number) =>
  z
    .string()
    .refine((value) => new TextEncoder().encode(value).length <= maximum, {
      message: `Must be at most ${maximum} UTF-8 bytes.`,
      params: { authoringPayloadLimit: true },
    });

const functionParameterSchema = z
  .object({
    name: z.string().max(200),
    type: z.string().min(1).max(100),
    optional: z.boolean().optional(),
  })
  .catchall(jsonSchema);

const createSchemaFieldSchema = <Field extends z.ZodType, Id extends z.ZodType>(
  fieldSchema: Field,
  identitySchema: Id,
) =>
  z
    .object({
      id: identitySchema,
      name: z.string().max(200),
      type: z.string().min(1).max(100),
      validations: z
        .array(
          z
            .object({
              id: identitySchema,
              type: z.string().min(1).max(100),
              message: shortTextSchema.default(''),
              value: shortTextSchema.default(''),
              transform: shortTextSchema.optional(),
              keyType: shortTextSchema.optional(),
              valueType: shortTextSchema.optional(),
              discriminator: shortTextSchema.optional(),
              cases: z.record(z.string(), z.array(fieldSchema)).optional(),
            })
            .catchall(jsonSchema),
        )
        .max(AUTHORING_LIMITS.validationsPerField)
        .default([]),
      params: z
        .object({
          ipVersion: z.string().optional(),
          coerce: z.boolean().optional(),
          description: shortTextSchema.optional(),
          invalid_type_error: shortTextSchema.optional(),
          required_error: shortTextSchema.optional(),
          enumValues: z.array(shortTextSchema).optional(),
          unionTypes: z.array(z.string()).optional(),
          isStrict: z.boolean().optional(),
          isPassthrough: z.boolean().optional(),
          pickOmitFields: z.array(z.string()).optional(),
          pickOmitType: z.enum(['pick', 'omit']).optional(),
          elementType: z.string().optional(),
          keyType: z.string().optional(),
          valueType: z.string().optional(),
          isTuple: z.boolean().optional(),
          tupleTypes: z.array(z.string()).optional(),
          isAsync: z.boolean().optional(),
          isDiscriminatedUnion: z.boolean().optional(),
          discriminator: z.string().optional(),
          functionParams: z.array(functionParameterSchema).optional(),
          returnType: z.string().optional(),
          stringOptions: z
            .object({
              datetime: z
                .object({
                  offset: z.boolean().optional(),
                  precision: z.number().int().optional(),
                })
                .catchall(jsonSchema)
                .optional(),
              ip: z
                .object({ version: z.enum(['v4', 'v6']).optional() })
                .catchall(jsonSchema)
                .optional(),
            })
            .catchall(jsonSchema)
            .optional(),
          timezoneOptions: z
            .object({
              offset: z.boolean().optional(),
              precision: z.number().int().optional(),
            })
            .catchall(jsonSchema)
            .optional(),
          discriminatedUnion: z
            .object({
              discriminator: z.string(),
              cases: z.record(
                z.string(),
                z
                  .object({
                    value: z.string(),
                    fields: z.array(fieldSchema),
                  })
                  .catchall(jsonSchema),
              ),
            })
            .catchall(jsonSchema)
            .optional(),
        })
        .catchall(jsonSchema)
        .default({}),
    })
    .catchall(jsonSchema);

export const authoringSchemaFieldSchema: z.ZodType<SchemaField> = z.lazy(() =>
  createSchemaFieldSchema(authoringSchemaFieldSchema, idSchema),
);
export type AuthoringSchemaField = z.infer<typeof authoringSchemaFieldSchema>;

type SubmittedSchemaField = Omit<
  SchemaField,
  'id' | 'validations' | 'params'
> & {
  id?: string;
  validations?: (Omit<ValidationRule, 'id' | 'message' | 'value' | 'cases'> & {
    id?: string;
    message?: string;
    value?: string;
    cases?: Record<string, SubmittedSchemaField[]>;
  })[];
  params?: Omit<SchemaField['params'], 'discriminatedUnion'> & {
    discriminatedUnion?: {
      discriminator: string;
      cases: Record<string, { value: string; fields: SubmittedSchemaField[] }>;
    };
  };
};

export const authoringSubmittedSchemaFieldSchema: z.ZodType<
  SubmittedSchemaField,
  SubmittedSchemaField
> = z.lazy(() =>
  createSchemaFieldSchema(
    authoringSubmittedSchemaFieldSchema,
    idSchema.optional(),
  ),
);
export type AuthoringSubmittedSchemaField = z.input<
  typeof authoringSubmittedSchemaFieldSchema
>;

export const promptAuthoringConfigSchema = z
  .object({
    schema: z
      .array(authoringSchemaFieldSchema)
      .max(AUTHORING_LIMITS.schemaFields)
      .default([]),
    model: idSchema.nullable().default(null),
    temperature: z.number().min(0).max(2).default(0.5),
    inputData: jsonSchema.default({}),
    inputDataRootName: z.string().max(200).nullable().default(null),
  })
  .catchall(jsonSchema);
export type PromptAuthoringConfig = z.infer<typeof promptAuthoringConfigSchema>;

export const composerAuthoringConfigSchema = z
  .object({
    schema: z
      .array(authoringSchemaFieldSchema)
      .max(AUTHORING_LIMITS.schemaFields)
      .default([]),
    inputData: jsonSchema.default(null),
    inputDataRootName: z.string().max(200).nullable().default(null),
  })
  .catchall(jsonSchema);
export type ComposerAuthoringConfig = z.infer<
  typeof composerAuthoringConfigSchema
>;

export const snippetAuthoringConfigSchema = z
  .object({
    model: idSchema.nullable().default(null),
    testUserMessage: byteLimitedText(AUTHORING_LIMITS.contentBytes).default(''),
  })
  .catchall(jsonSchema);
export type SnippetAuthoringConfig = z.infer<
  typeof snippetAuthoringConfigSchema
>;

export const promptSnippetReferenceSchema = z.strictObject({
  snippetId: idSchema,
  snippetVersionId: idSchema.nullable().default(null),
  sortOrder: z.number().int().min(0).max(100_000),
});
export type PromptSnippetReference = z.infer<
  typeof promptSnippetReferenceSchema
>;

export const composerPromptReferenceSchema = z.strictObject({
  promptId: idSchema,
  promptVersionId: idSchema.nullable(),
  autoUpdate: z.boolean(),
});
export type ComposerPromptReference = z.infer<
  typeof composerPromptReferenceSchema
>;

const definitionMetadata = {
  name: z.string().min(2).max(200),
  description: z.string().max(10_000).default(''),
  labels: z.string().max(10_000).nullable().default(null),
};

export const promptDefinitionSchema = z.strictObject({
  ...definitionMetadata,
  systemMessage: byteLimitedText(AUTHORING_LIMITS.contentBytes).default(''),
  userMessage: byteLimitedText(AUTHORING_LIMITS.contentBytes).default(''),
  config: promptAuthoringConfigSchema.prefault({}),
  snippets: z
    .array(promptSnippetReferenceSchema)
    .max(AUTHORING_LIMITS.references)
    .default([]),
});
export type PromptDefinition = z.infer<typeof promptDefinitionSchema>;

export const composerDefinitionSchema = z.strictObject({
  ...definitionMetadata,
  content: byteLimitedText(AUTHORING_LIMITS.contentBytes).default(''),
  config: composerAuthoringConfigSchema.prefault({}),
});
export type ComposerDefinition = z.infer<typeof composerDefinitionSchema>;

export const snippetDefinitionSchema = z.strictObject({
  ...definitionMetadata,
  content: byteLimitedText(AUTHORING_LIMITS.contentBytes).default(''),
  config: snippetAuthoringConfigSchema.prefault({}),
});
export type SnippetDefinition = z.infer<typeof snippetDefinitionSchema>;

const submittedFieldsSchema = z
  .array(authoringSubmittedSchemaFieldSchema)
  .max(AUTHORING_LIMITS.schemaFields);

export const promptSubmittedDefinitionSchema = promptDefinitionSchema.extend({
  config: promptAuthoringConfigSchema
    .extend({ schema: submittedFieldsSchema.default([]) })
    .prefault({}),
});
export type PromptSubmittedDefinitionInput = z.input<
  typeof promptSubmittedDefinitionSchema
>;

export const composerSubmittedDefinitionSchema =
  composerDefinitionSchema.extend({
    config: composerAuthoringConfigSchema
      .extend({ schema: submittedFieldsSchema.default([]) })
      .prefault({}),
  });
export type ComposerSubmittedDefinitionInput = z.input<
  typeof composerSubmittedDefinitionSchema
>;

const commonConfigPatch = {
  schema: submittedFieldsSchema.optional(),
  inputData: jsonSchema.optional(),
  inputDataRootName: z.string().max(200).nullable().optional(),
};

export const promptAuthoringPatchSchema = z.strictObject({
  name: definitionMetadata.name.optional(),
  description: definitionMetadata.description.removeDefault().optional(),
  labels: definitionMetadata.labels.removeDefault().optional(),
  systemMessage: promptDefinitionSchema.shape.systemMessage
    .removeDefault()
    .optional(),
  userMessage: promptDefinitionSchema.shape.userMessage
    .removeDefault()
    .optional(),
  config: z
    .object({
      ...commonConfigPatch,
      model: idSchema.nullable().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .catchall(jsonSchema)
    .optional(),
  snippets: promptDefinitionSchema.shape.snippets.removeDefault().optional(),
});
export type PromptAuthoringPatchInput = z.input<
  typeof promptAuthoringPatchSchema
>;

export const composerAuthoringPatchSchema = z.strictObject({
  name: definitionMetadata.name.optional(),
  description: definitionMetadata.description.removeDefault().optional(),
  labels: definitionMetadata.labels.removeDefault().optional(),
  content: composerDefinitionSchema.shape.content.removeDefault().optional(),
  config: z.object(commonConfigPatch).catchall(jsonSchema).optional(),
});
export type ComposerAuthoringPatchInput = z.input<
  typeof composerAuthoringPatchSchema
>;

const replacementText = {
  oldText: byteLimitedText(AUTHORING_LIMITS.contentBytes).refine(
    (value) => value.length > 0,
    'The exact source text must not be empty.',
  ),
  newText: byteLimitedText(AUTHORING_LIMITS.contentBytes),
};
export const promptTextReplacementSchema = z.strictObject({
  field: z.enum(['systemMessage', 'userMessage']),
  ...replacementText,
});
export type PromptTextReplacementInput = z.input<
  typeof promptTextReplacementSchema
>;
export const composerTextReplacementSchema = z.strictObject({
  field: z.literal('content'),
  ...replacementText,
});
export type ComposerTextReplacementInput = z.input<
  typeof composerTextReplacementSchema
>;

export const promptAuthoringEditSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('patch'),
    changes: promptAuthoringPatchSchema.optional(),
    replacements: z.array(promptTextReplacementSchema).max(100).optional(),
  }),
  z.strictObject({
    mode: z.literal('replace'),
    definition: promptSubmittedDefinitionSchema,
  }),
]);
export type PromptAuthoringEditInput = z.input<
  typeof promptAuthoringEditSchema
>;

export const composerAuthoringEditSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('patch'),
    changes: composerAuthoringPatchSchema.optional(),
    replacements: z.array(composerTextReplacementSchema).max(100).optional(),
  }),
  z.strictObject({
    mode: z.literal('replace'),
    definition: composerSubmittedDefinitionSchema,
  }),
]);
export type ComposerAuthoringEditInput = z.input<
  typeof composerAuthoringEditSchema
>;

export const authoringSemverSchema = z
  .string()
  .max(100)
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .refine(
    (value) =>
      value.split('.').every((part) => Number.isSafeInteger(Number(part))),
    'Version components must be safe integers.',
  );
export type AuthoringSemverInput = z.input<typeof authoringSemverSchema>;

export const authoringContentKindSchema = z.enum([
  'prompt',
  'composer',
  'snippet',
]);
export type AuthoringContentKind = z.infer<typeof authoringContentKindSchema>;

export const authoringVersionSelectorSchema = z.union([
  z.strictObject({ kind: z.literal('draft') }),
  z.strictObject({ kind: z.literal('latest') }),
  z.strictObject({ kind: z.literal('working') }),
  z.strictObject({ kind: z.literal('published'), versionId: idSchema }),
  z.strictObject({
    kind: z.literal('published'),
    version: authoringSemverSchema,
  }),
]);
export type AuthoringVersionSelector = z.infer<
  typeof authoringVersionSelectorSchema
>;

export const authoringReadInputSchema = z.strictObject({
  organizationId: idSchema,
  id: idSchema,
  version: authoringVersionSelectorSchema,
});
export type AuthoringReadInput = z.infer<typeof authoringReadInputSchema>;

export const authoringPageSchema = z.object({
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(100).default(25),
});
export const authoringListVersionsInputSchema = z.strictObject({
  organizationId: idSchema,
  id: idSchema,
  kind: authoringContentKindSchema,
  ...authoringPageSchema.shape,
});
export type AuthoringListVersionsInput = z.input<
  typeof authoringListVersionsInputSchema
>;

export const authoringListModelsInputSchema = z.strictObject({
  organizationId: idSchema,
  ...authoringPageSchema.shape,
});
export type AuthoringListModelsInput = z.input<
  typeof authoringListModelsInputSchema
>;
