import { parseComposerContent } from '../composer-content-parser';
import type { SchemaField } from '../schema-types';
import type {
  ComposerDefinition,
  PromptDefinition,
} from '../validations/authoring';
import type { AuthoringDiagnostic } from './types';

const fieldTypes = new Set([
  'string',
  'number',
  'boolean',
  'date',
  'bigint',
  'null',
  'undefined',
  'void',
  'any',
  'unknown',
  'never',
  'nan',
  'literal',
  'enum',
  'nativeEnum',
  'array',
  'object',
  'record',
  'map',
  'set',
  'union',
  'intersection',
  'tuple',
  'promise',
  'function',
  'lazy',
  'custom',
  'pipeline',
  'instanceof',
  'symbol',
]);

const rules = new Set([
  'min',
  'max',
  'length',
  'size',
  'email',
  'url',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'regex',
  'startsWith',
  'endsWith',
  'datetime',
  'ip',
  'trim',
  'toLowerCase',
  'toUpperCase',
  'int',
  'positive',
  'negative',
  'multipleOf',
  'finite',
  'safe',
  'nonempty',
  'optional',
  'nullable',
  'nullish',
  'default',
  'transform',
  'refine',
  'superRefine',
  'brand',
  'readonly',
  'catch',
  'element',
]);

const diagnostic = (
  code: string,
  path: (string | number)[],
  message: string,
): AuthoringDiagnostic => ({ code, path, message, severity: 'error' });

// These checks inspect the saved schema without evaluating customer expressions.
// Sample-data validation is a separate preview concern, never a publish gate.
export const inspectAuthoringSchema = (
  fields: readonly SchemaField[],
  prefix: (string | number)[] = ['config', 'schema'],
): AuthoringDiagnostic[] => {
  const diagnostics: AuthoringDiagnostic[] = [];
  for (const [index, field] of fields.entries()) {
    const path = [...prefix, index];
    if (!fieldTypes.has(field.type))
      diagnostics.push(
        diagnostic(
          'unknown_field_type',
          [...path, 'type'],
          `Schema type ${field.type} is not supported by Promptly.`,
        ),
      );
    if (field.type === 'enum' && !field.params.enumValues?.length)
      diagnostics.push(
        diagnostic(
          'empty_enum',
          [...path, 'params', 'enumValues'],
          'Add at least one allowed enum value before publication.',
        ),
      );
    if (field.params.isStrict && field.params.isPassthrough)
      diagnostics.push(
        diagnostic(
          'contradictory_object_options',
          [...path, 'params'],
          'An object cannot both reject and preserve unknown properties.',
        ),
      );
    const union = field.params.discriminatedUnion;
    if (field.params.isDiscriminatedUnion) {
      if (!union?.discriminator.trim() || !Object.keys(union.cases).length)
        diagnostics.push(
          diagnostic(
            'incomplete_discriminated_union',
            [...path, 'params'],
            'A discriminated union needs a discriminator and at least one case.',
          ),
        );
      if (union) {
        const values = new Set<string>();
        for (const [key, entry] of Object.entries(union.cases)) {
          const casePath = [
            ...path,
            'params',
            'discriminatedUnion',
            'cases',
            key,
          ];
          if (values.has(entry.value))
            diagnostics.push(
              diagnostic(
                'duplicate_union_case',
                [...casePath, 'value'],
                'Each discriminated-union case must have a distinct value.',
              ),
            );
          values.add(entry.value);
          if (entry.fields.some((child) => child.name === union.discriminator))
            diagnostics.push(
              diagnostic(
                'discriminator_redefined',
                [...casePath, 'fields'],
                'The discriminator is supplied by the case; do not redefine it as a field.',
              ),
            );
          diagnostics.push(
            ...inspectAuthoringSchema(entry.fields, [...casePath, 'fields']),
          );
        }
      }
    }
    for (const [ruleIndex, rule] of field.validations.entries()) {
      const rulePath = [...path, 'validations', ruleIndex];
      if (!rules.has(rule.type))
        diagnostics.push(
          diagnostic(
            'unknown_validation',
            [...rulePath, 'type'],
            `Validation ${rule.type} is not supported by Promptly.`,
          ),
        );
      if (['min', 'max', 'length', 'size', 'multipleOf'].includes(rule.type)) {
        const value = Number(rule.value);
        const dateBound =
          field.type === 'date' && ['min', 'max'].includes(rule.type);
        const valid = dateBound
          ? rule.value.trim() !== '' && Number.isFinite(Date.parse(rule.value))
          : rule.value.trim() !== '' && Number.isFinite(value);
        if (
          !valid ||
          (rule.type === 'multipleOf' && value <= 0) ||
          (['string', 'array', 'set'].includes(field.type) &&
            (!Number.isSafeInteger(value) || value < 0))
        )
          diagnostics.push(
            diagnostic(
              'invalid_validation_value',
              [...rulePath, 'value'],
              'Supply a valid bound for this validation.',
            ),
          );
      }
      if (rule.type === 'regex') {
        try {
          new RegExp(rule.value);
        } catch {
          diagnostics.push(
            diagnostic(
              'invalid_regular_expression',
              [...rulePath, 'value'],
              'Correct this regular expression before publication.',
            ),
          );
        }
      }
      for (const [key, children] of Object.entries(rule.cases ?? {}))
        diagnostics.push(
          ...inspectAuthoringSchema(children, [...rulePath, 'cases', key]),
        );
    }
  }
  return diagnostics;
};

const inspectPaths = (
  paths: Iterable<string>,
  fields: readonly SchemaField[],
  path: (string | number)[],
): AuthoringDiagnostic[] => {
  const declared = new Set(fields.map((field) => field.name));
  return [...new Set(paths)]
    .filter((value) => !declared.has(value.split('.')[0]))
    .map((value) =>
      diagnostic(
        'undeclared_variable',
        path,
        `Declare the input field used by ${value} before publication.`,
      ),
    );
};

export const inspectPromptReadiness = (
  definition: PromptDefinition,
  options: {
    snippets?: readonly { snippetId: string; content: string }[];
  } = {},
): AuthoringDiagnostic[] => {
  const diagnostics = inspectAuthoringSchema(definition.config.schema);
  const texts: { text: string; path: (string | number)[] }[] = [
    { text: definition.systemMessage, path: ['systemMessage'] },
    { text: definition.userMessage, path: ['userMessage'] },
    ...(options.snippets ?? []).map((snippet) => ({
      text: snippet.content,
      path: ['snippets', snippet.snippetId],
    })),
  ];
  for (const { text, path } of texts)
    diagnostics.push(
      ...inspectPaths(
        [...text.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]),
        definition.config.schema,
        path,
      ),
    );
  return diagnostics;
};

const decodeAttribute = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attributesOf = (tag: string) =>
  new Map(
    [
      ...tag.matchAll(
        /\s([A-Za-z][A-Za-z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
      ),
    ].map((match) => [match[1], match[2] ?? match[3] ?? match[4] ?? '']),
  );

export const inspectComposerReadiness = (
  definition: ComposerDefinition,
  options: {
    prompts?: readonly { promptId: string; definition: PromptDefinition }[];
  } = {},
): AuthoringDiagnostic[] => {
  const diagnostics = inspectAuthoringSchema(definition.config.schema);
  const byName = new Map(
    definition.config.schema.map((field) => [field.name, field]),
  );
  const permitsMissing = (field: SchemaField) =>
    ['any', 'unknown', 'undefined', 'void'].includes(field.type) ||
    field.validations.some((rule) =>
      ['optional', 'nullish', 'default', 'catch'].includes(rule.type),
    );
  const scalarTypes = new Set([
    'string',
    'number',
    'boolean',
    'null',
    'array',
    'object',
  ]);
  for (const prompt of options.prompts ?? []) {
    for (const field of prompt.definition.config.schema) {
      const source = byName.get(field.name);
      const path = ['references', prompt.promptId, 'schema', field.name];
      if (!permitsMissing(field) && (!source || permitsMissing(source)))
        diagnostics.push(
          diagnostic(
            'missing_dependency_input',
            path,
            `Referenced prompt ${prompt.promptId} requires ${field.name}; declare it as a required composer input.`,
          ),
        );
      else if (
        source &&
        source.type !== field.type &&
        scalarTypes.has(source.type) &&
        scalarTypes.has(field.type) &&
        !field.params.coerce
      )
        diagnostics.push(
          diagnostic(
            'incompatible_dependency_input',
            path,
            `Composer input ${field.name} is ${source.type}, but referenced prompt ${prompt.promptId} expects ${field.type}.`,
          ),
        );
    }
  }
  const fields = new Map(
    definition.config.schema.map((field) => [field.id, field]),
  );
  const slices = [
    definition.content,
    ...parseComposerContent(definition.content).flatMap((segment) =>
      segment.type === 'html_block' ? [segment.innerHtml] : [],
    ),
  ];
  for (const text of slices) {
    for (const [tag] of text.matchAll(/<[^>]+>/g)) {
      const attributes = attributesOf(tag);
      if (attributes.has('data-variable-ref')) {
        const id = attributes.get('data-field-id');
        const encodedPath = attributes.get('data-field-path');
        const field = id ? fields.get(id) : undefined;
        if (!field || encodedPath === undefined)
          diagnostics.push(
            diagnostic(
              'unresolved_variable',
              ['content'],
              'A variable badge must identify a declared field and its path.',
            ),
          );
        else if (decodeAttribute(encodedPath) !== field.name)
          diagnostics.push(
            diagnostic(
              'variable_path_mismatch',
              ['content'],
              `The variable badge for ${field.name} still uses another path. Rebuild the badge without changing its field ID.`,
            ),
          );
      }
      if (
        attributes.has('data-prompt-ref') &&
        !/\sdata-prompt-id="[A-Za-z0-9_-]+"/.test(tag)
      )
        diagnostics.push(
          diagnostic(
            'malformed_prompt_reference',
            ['content'],
            'A prompt badge must contain a valid prompt ID in canonical HTML.',
          ),
        );
      const href = attributes.get('href');
      if (href !== undefined)
        diagnostics.push(
          ...inspectPaths(
            [...decodeAttribute(href).matchAll(/\{\{([^}]+)\}\}/g)].map(
              (match) => match[1],
            ),
            definition.config.schema,
            ['content'],
          ),
        );
    }
  }
  return diagnostics;
};
