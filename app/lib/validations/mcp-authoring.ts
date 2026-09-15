import { z } from 'zod';
import {
  AUTHORING_LIMITS,
  authoringContentKindSchema,
  authoringPageSchema,
  authoringSemverSchema,
  authoringVersionSelectorSchema,
  composerDefinitionSchema,
  promptDefinitionSchema,
  snippetDefinitionSchema,
} from './authoring';
import {
  authoringHistoryKindSchema,
  authoringStoredVersionSchema,
} from './authoring-history';
import { composerMarkupPartsSchema } from './composer-markup';

const id = z.string().min(1).max(200);
export const mcpAuthoringReadSchema = z.strictObject({
  id,
  version: authoringVersionSelectorSchema,
});
export type McpAuthoringReadInput = z.input<typeof mcpAuthoringReadSchema>;
export const mcpAuthoringListVersionsSchema = z.strictObject({
  id,
  kind: authoringContentKindSchema,
  ...authoringPageSchema.shape,
});
export type McpAuthoringListVersionsInput = z.input<
  typeof mcpAuthoringListVersionsSchema
>;
export const mcpAuthoringListModelsSchema = z.strictObject(
  authoringPageSchema.shape,
);
export type McpAuthoringListModelsInput = z.input<
  typeof mcpAuthoringListModelsSchema
>;

export const mcpAuthoringPreviewInputSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('supplied'),
    data: z.json(),
    rootName: z.string().max(200).nullable().optional(),
  }),
  z.strictObject({ source: z.literal('saved_sample') }),
  z.strictObject({ source: z.literal('empty') }),
]);
export type McpAuthoringPreviewInput = z.input<
  typeof mcpAuthoringPreviewInputSchema
>;
export const mcpAuthoringPreviewSchema = mcpAuthoringReadSchema.extend({
  input: mcpAuthoringPreviewInputSchema,
});
export type McpAuthoringPreviewRequest = z.input<
  typeof mcpAuthoringPreviewSchema
>;
export const mcpComposerMarkupSchema = z.strictObject({
  composerId: id.optional(),
  parts: composerMarkupPartsSchema,
});
export type McpComposerMarkupInput = z.input<typeof mcpComposerMarkupSchema>;

export const mcpAuthoringDiagnosticSchema = z.strictObject({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});
export const mcpAuthoringErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    diagnostics: z.array(mcpAuthoringDiagnosticSchema),
    details: z
      .strictObject({ currentRevision: z.string().nullable() })
      .optional(),
  }),
});
export type McpAuthoringError = z.infer<typeof mcpAuthoringErrorSchema>;
export const mcpAuthoringMetadataSchema = z.strictObject({
  id: z.string(),
  organizationId: z.string(),
  kind: authoringContentKindSchema,
  folderId: z.string().nullable(),
  revision: z.string().nullable(),
});
export const mcpAuthoringDependencySchema = z.strictObject({
  kind: z.enum(['prompt', 'snippet']),
  id: z.string(),
  name: z.string(),
  pinnedVersionId: z.string().nullable(),
  resolvedVersionId: z.string().nullable(),
  resolvedVersion: z.string().nullable(),
});
const readOutput = {
  metadata: mcpAuthoringMetadataSchema,
  version: authoringStoredVersionSchema,
  dependencies: z.array(mcpAuthoringDependencySchema),
  diagnostics: z.array(mcpAuthoringDiagnosticSchema),
};
export const mcpPromptReadOutputSchema = z.strictObject({
  ...readOutput,
  definition: promptDefinitionSchema,
});
export const mcpComposerReadOutputSchema = z.strictObject({
  ...readOutput,
  definition: composerDefinitionSchema,
});
export const mcpSnippetReadOutputSchema = z.strictObject({
  ...readOutput,
  definition: snippetDefinitionSchema,
});
export const mcpAuthoringVersionsOutputSchema = z.strictObject({
  items: z.array(authoringStoredVersionSchema),
  nextOffset: z.number().nullable(),
});
export const mcpAuthoringModelsOutputSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string(),
      displayName: z.string(),
      provider: z.enum(['openai', 'anthropic', 'google']),
    }),
  ),
  nextOffset: z.number().nullable(),
});
export const mcpAuthoringValidationOutputSchema = z.strictObject({
  ...readOutput,
  valid: z.boolean(),
});
const previewOutput = {
  ...readOutput,
  valid: z.boolean(),
  inputSource: z.enum(['supplied', 'saved_sample', 'empty']),
  executed: z.literal(false),
};
export const mcpPromptPreviewOutputSchema = z.strictObject({
  ...previewOutput,
  systemMessage: z.string(),
  userMessage: z.string(),
  unusedFields: z.array(z.string()),
});
export const mcpComposerPreviewOutputSchema = z.strictObject({
  ...previewOutput,
  segments: z.array(
    z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('html'), html: z.string() }),
      z.strictObject({
        kind: z.literal('prompt_placeholder'),
        promptId: z.string(),
        label: z.string(),
      }),
    ]),
  ),
  rendering: z.string(),
});
export const mcpComposerMarkupOutputSchema = z.strictObject({
  html: z.string(),
  diagnostics: z.array(mcpAuthoringDiagnosticSchema),
});
export const mcpAuthoringMutationOutputSchema = z.strictObject({
  id: z.string(),
  kind: authoringHistoryKindSchema,
  changeId: z.string(),
  versionId: z.string(),
  revision: z.string(),
  status: z.enum(['draft', 'published']),
  version: authoringSemverSchema.nullable(),
  url: z.string(),
  diagnostics: z.array(mcpAuthoringDiagnosticSchema),
  assignedIds: z.array(
    z.strictObject({
      kind: z.enum(['field', 'validation']),
      path: z.array(z.union([z.string(), z.number()])),
      id: z.string(),
    }),
  ),
});
export const mcpAuthoringChangeSummarySchema = z.strictObject({
  id: z.string(),
  document: z.strictObject({
    kind: authoringHistoryKindSchema,
    id: z.string(),
    name: z.string(),
  }),
  actor: z.strictObject({
    userId: z.string().nullable(),
    name: z.string(),
    source: z.enum(['browser', 'mcp']),
    clientId: z.string().nullable(),
    clientName: z.string().nullable(),
    connectionId: z.string().nullable(),
  }),
  operation: z.string(),
  revision: z.string(),
  versionId: z.string().nullable(),
  createdAt: z.number(),
  expiresAt: z.number(),
});
export const mcpAuthoringChangesOutputSchema = z.strictObject({
  items: z.array(mcpAuthoringChangeSummarySchema),
  nextOffset: z.number().nullable(),
});
const snapshotCommon = {
  folderId: z.string().nullable(),
  version: authoringStoredVersionSchema,
};
export const mcpAuthoringSnapshotSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...snapshotCommon,
    kind: z.literal('prompt'),
    definition: promptDefinitionSchema,
  }),
  z.strictObject({
    ...snapshotCommon,
    kind: z.literal('composer'),
    definition: composerDefinitionSchema,
  }),
]);
export const mcpAuthoringChangeOutputSchema = z.strictObject({
  change: mcpAuthoringChangeSummarySchema,
  before: mcpAuthoringSnapshotSchema.nullable(),
  after: mcpAuthoringSnapshotSchema,
});

export const mcpNativePromptArgumentsSchema = z
  .strictObject({
    input: z
      .string()
      .max(AUTHORING_LIMITS.sampleBytes)
      .describe(
        'Required JSON input values. Supply {} for a prompt without inputs.',
      ),
    version: z
      .union([z.literal('latest'), authoringSemverSchema])
      .default('latest'),
    versionId: id.optional(),
    rootName: z.string().max(200).optional(),
  })
  .refine(
    (value) => value.versionId === undefined || value.version === 'latest',
    'Choose either version or versionId, not both.',
  );
export type McpNativePromptArguments = z.input<
  typeof mcpNativePromptArgumentsSchema
>;
export const mcpNativePromptCursorSchema = z.strictObject({
  workspaceId: id,
  after: id,
});
export type McpNativePromptCursor = z.infer<typeof mcpNativePromptCursorSchema>;
