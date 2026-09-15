import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  extractPromptIds,
  extractPromptVersionPins,
  extractVariableIds,
  parseComposerContent,
} from '../composer-content-parser';
import type { SchemaField } from '../schema-types';
import {
  AUTHORING_LIMITS,
  type ComposerDefinition,
  type ComposerPromptReference,
  composerDefinitionSchema,
  type PromptDefinition,
  promptDefinitionSchema,
  snippetDefinitionSchema,
} from '../validations/authoring';
import {
  type AssignedAuthoringId,
  type AuthoringDiagnostic,
  AuthoringError,
  type NormalizedAuthoringDefinition,
  type NormalizedComposerDefinition,
} from './types';

export const assertAuthoringJson = (
  value: unknown,
  maximum: number = AUTHORING_LIMITS.definitionBytes,
) => {
  const pending: { value: unknown; depth: number; ancestors: object[] }[] = [
    { value, depth: 0, ancestors: [] },
  ];
  let nodes = 0;
  while (pending.length) {
    const entry = pending.pop();
    if (!entry) break;
    nodes += 1;
    if (
      entry.depth > AUTHORING_LIMITS.jsonDepth ||
      nodes > AUTHORING_LIMITS.jsonNodes
    ) {
      throw new AuthoringError(
        'payload_too_large',
        'JSON nesting or element count exceeds authoring limits.',
      );
    }
    const item = entry.value;
    if (item === null || typeof item === 'string' || typeof item === 'boolean')
      continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (typeof item !== 'object' || entry.ancestors.includes(item)) {
      throw new AuthoringError(
        'invalid_input',
        'Authoring definitions must contain finite, acyclic JSON values.',
      );
    }
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    ) {
      throw new AuthoringError(
        'invalid_input',
        'Authoring definitions must contain plain JSON objects.',
      );
    }
    if (
      Array.isArray(item) &&
      (Object.keys(item).length !== item.length ||
        Object.keys(item).some((key, index) => key !== String(index)))
    ) {
      throw new AuthoringError(
        'invalid_input',
        'Authoring arrays must contain an explicit JSON value at every index.',
      );
    }
    const ancestors = [...entry.ancestors, item];
    for (const child of Object.values(item))
      pending.push({ value: child, depth: entry.depth + 1, ancestors });
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > maximum) {
    throw new AuthoringError(
      'payload_too_large',
      `Definition exceeds ${maximum} UTF-8 JSON bytes.`,
    );
  }
};

export const parseAuthoringValue = <T>(
  schema: z.ZodType<T>,
  value: unknown,
): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const exceedsLimit = parsed.error.issues.some(
      (issue) =>
        issue.code === 'too_big' ||
        (issue.code === 'custom' &&
          issue.params?.authoringPayloadLimit === true),
    );
    throw new AuthoringError(
      exceedsLimit ? 'payload_too_large' : 'invalid_input',
      'Check the authoring definition.',
      parsed.error.issues.map((issue) => ({
        code: issue.code,
        severity: 'error',
        path: issue.path.map((part) =>
          typeof part === 'symbol' ? String(part) : part,
        ),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
};

const objectSchema = z.record(z.string(), z.unknown());

const assignSchemaIds = (
  value: unknown,
  assignedIds: AssignedAuthoringId[],
): unknown => {
  const assignFields = (
    fields: unknown,
    path: (string | number)[],
  ): unknown => {
    if (!Array.isArray(fields)) return fields;
    return fields.map((field, index) => {
      const parsed = objectSchema.safeParse(field);
      if (!parsed.success) return field;
      const next = parsed.data;
      const fieldPath = [...path, index];
      if (next.id === undefined) {
        next.id = nanoid();
        assignedIds.push({
          kind: 'field',
          path: [...fieldPath, 'id'],
          id: String(next.id),
        });
      }
      if (Array.isArray(next.validations)) {
        next.validations = next.validations.map((rule, ruleIndex) => {
          const result = objectSchema.safeParse(rule);
          if (!result.success) return rule;
          const updated = result.data;
          const rulePath = [...fieldPath, 'validations', ruleIndex];
          if (updated.id === undefined) {
            updated.id = nanoid();
            assignedIds.push({
              kind: 'validation',
              path: [...rulePath, 'id'],
              id: String(updated.id),
            });
          }
          const cases = objectSchema.safeParse(updated.cases);
          if (cases.success)
            updated.cases = Object.fromEntries(
              Object.entries(cases.data).map(([key, children]) => [
                key,
                assignFields(children, [...rulePath, 'cases', key]),
              ]),
            );
          return updated;
        });
      }
      const params = objectSchema.safeParse(next.params);
      if (params.success) {
        const union = objectSchema.safeParse(params.data.discriminatedUnion);
        if (union.success) {
          const cases = objectSchema.safeParse(union.data.cases);
          if (cases.success) {
            union.data.cases = Object.fromEntries(
              Object.entries(cases.data).map(([key, caseValue]) => {
                const caseData = objectSchema.safeParse(caseValue);
                return [
                  key,
                  caseData.success
                    ? {
                        ...caseData.data,
                        fields: assignFields(caseData.data.fields, [
                          ...fieldPath,
                          'params',
                          'discriminatedUnion',
                          'cases',
                          key,
                          'fields',
                        ]),
                      }
                    : caseValue,
                ];
              }),
            );
            next.params = { ...params.data, discriminatedUnion: union.data };
          }
        }
      }
      return next;
    });
  };
  const input = objectSchema.safeParse(value);
  if (!input.success) return value;
  const config = objectSchema.safeParse(input.data.config);
  if (!config.success || config.data.schema === undefined) return value;
  return {
    ...input.data,
    config: {
      ...config.data,
      schema: assignFields(config.data.schema, ['config', 'schema']),
    },
  };
};

const inspectSchemaFields = (fields: SchemaField[]): AuthoringDiagnostic[] => {
  const diagnostics: AuthoringDiagnostic[] = [];
  const ids = new Set<string>();
  let count = 0;
  const rememberId = (id: string, path: (string | number)[]) => {
    if (ids.has(id))
      throw new AuthoringError(
        'invalid_input',
        'Schema field and validation IDs must be unique.',
        [
          {
            code: 'duplicate_id',
            severity: 'error',
            path,
            message: 'This ID is already used in the schema.',
          },
        ],
      );
    ids.add(id);
  };
  const visit = (items: SchemaField[], path: (string | number)[]) => {
    const names = new Set<string>();
    for (const [index, field] of items.entries()) {
      count += 1;
      const fieldPath = [...path, index];
      rememberId(field.id, [...fieldPath, 'id']);
      if (!field.name.trim() || names.has(field.name))
        diagnostics.push({
          code: field.name.trim() ? 'duplicate_field_name' : 'unnamed_field',
          severity: 'error',
          path: [...fieldPath, 'name'],
          message: field.name.trim()
            ? 'Field names must be unique within this object before publication.'
            : 'Name this field before publication.',
        });
      names.add(field.name);
      for (const [ruleIndex, rule] of field.validations.entries()) {
        const rulePath = [...fieldPath, 'validations', ruleIndex];
        rememberId(rule.id, [...rulePath, 'id']);
        for (const [key, children] of Object.entries(rule.cases ?? {}))
          visit(children, [...rulePath, 'cases', key]);
      }
      for (const [key, entry] of Object.entries(
        field.params.discriminatedUnion?.cases ?? {},
      ))
        visit(entry.fields, [
          ...fieldPath,
          'params',
          'discriminatedUnion',
          'cases',
          key,
          'fields',
        ]);
    }
  };
  visit(fields, ['config', 'schema']);
  if (count > AUTHORING_LIMITS.schemaFields)
    throw new AuthoringError(
      'payload_too_large',
      `A definition may contain at most ${AUTHORING_LIMITS.schemaFields} schema fields, including nested cases.`,
    );
  return diagnostics;
};

const inspectDefinition = <T extends { config: unknown }>(definition: T) => {
  assertAuthoringJson(definition);
  assertAuthoringJson(definition.config, AUTHORING_LIMITS.configBytes);
};

export const parsePromptDefinition = (
  value: unknown,
): NormalizedAuthoringDefinition<PromptDefinition> => {
  assertAuthoringJson(value);
  const definition = parseAuthoringValue(promptDefinitionSchema, value);
  inspectDefinition(definition);
  assertAuthoringJson(
    definition.config.inputData,
    AUTHORING_LIMITS.sampleBytes,
  );
  const snippetIds = new Set(definition.snippets.map((ref) => ref.snippetId));
  if (snippetIds.size !== definition.snippets.length)
    throw new AuthoringError(
      'invalid_input',
      'A snippet may only be attached once to a prompt.',
    );
  definition.snippets.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.snippetId.localeCompare(b.snippetId),
  );
  return {
    definition,
    assignedIds: [],
    diagnostics: inspectSchemaFields(definition.config.schema),
  };
};

export const composerReferencesFromContent = (
  content: string,
): ComposerPromptReference[] => {
  const occurrences = new Map<string, string | null>();
  const slices = [
    content,
    ...parseComposerContent(content).flatMap((segment) =>
      segment.type === 'html_block' ? [segment.innerHtml] : [],
    ),
  ];
  for (const slice of slices) {
    for (const tag of slice.matchAll(/<[^>]+>/g)) {
      const id = /\bdata-prompt-id="([a-zA-Z0-9_-]+)"/.exec(tag[0])?.[1];
      if (!id) continue;
      const pin =
        /\bdata-prompt-version-id="([a-zA-Z0-9_-]+)"/.exec(tag[0])?.[1] ?? null;
      if (occurrences.has(id) && occurrences.get(id) !== pin)
        throw new AuthoringError(
          'invalid_input',
          'Every occurrence of a prompt in a composer must use the same version selection.',
          [
            {
              code: 'conflicting_prompt_pins',
              severity: 'error',
              path: ['content'],
              message:
                'Use the same pinned version or auto-update selection for this repeated prompt.',
            },
          ],
        );
      occurrences.set(id, pin);
    }
  }
  const ids = extractPromptIds(content);
  if (ids.length > AUTHORING_LIMITS.references)
    throw new AuthoringError(
      'payload_too_large',
      `A composer may reference at most ${AUTHORING_LIMITS.references} prompts.`,
    );
  const pins = extractPromptVersionPins(content);
  return ids.map((promptId) => ({
    promptId,
    promptVersionId: pins.get(promptId) ?? null,
    autoUpdate: !pins.has(promptId),
  }));
};

export const parseComposerDefinition = (
  value: unknown,
): NormalizedComposerDefinition<ComposerDefinition> => {
  assertAuthoringJson(value);
  const definition = parseAuthoringValue(composerDefinitionSchema, value);
  inspectDefinition(definition);
  assertAuthoringJson(
    definition.config.inputData,
    AUTHORING_LIMITS.sampleBytes,
  );
  const diagnostics = inspectSchemaFields(definition.config.schema);
  const fieldIds = new Set(definition.config.schema.map((field) => field.id));
  for (const id of extractVariableIds(definition.content)) {
    if (!fieldIds.has(id))
      diagnostics.push({
        code: 'unresolved_variable',
        severity: 'error',
        path: ['content'],
        message: `Variable reference ${id} does not identify a top-level schema field.`,
      });
  }
  return {
    definition,
    assignedIds: [],
    diagnostics,
    promptReferences: composerReferencesFromContent(definition.content),
  };
};

export const parseSnippetDefinition = (value: unknown) => {
  assertAuthoringJson(value);
  const definition = parseAuthoringValue(snippetDefinitionSchema, value);
  inspectDefinition(definition);
  return definition;
};

export const normalizePromptDefinition = (
  value: unknown,
): NormalizedAuthoringDefinition<PromptDefinition> => {
  assertAuthoringJson(value);
  const assignedIds: AssignedAuthoringId[] = [];
  return {
    ...parsePromptDefinition(assignSchemaIds(value, assignedIds)),
    assignedIds,
  };
};

export const normalizeComposerDefinition = (
  value: unknown,
): NormalizedComposerDefinition<ComposerDefinition> => {
  assertAuthoringJson(value);
  const assignedIds: AssignedAuthoringId[] = [];
  return {
    ...parseComposerDefinition(assignSchemaIds(value, assignedIds)),
    assignedIds,
  };
};
