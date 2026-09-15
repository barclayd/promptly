import {
  normalizeComposerDefinition,
  normalizePromptDefinition,
} from '../../app/lib/authoring/normalize';
import {
  inspectComposerReadiness,
  inspectPromptReadiness,
} from '../../app/lib/authoring/readiness';
import { expect, test } from '../fixtures/base';

test('composer publication checks required dependency inputs without treating empty sample data as invalid', () => {
  const composer = normalizeComposerDefinition({
    name: 'Composer inputs',
    config: {
      schema: [
        { name: 'customer', type: 'string' },
        { name: 'count', type: 'string' },
        { name: 'region', type: 'string', validations: [{ type: 'optional' }] },
      ],
    },
  }).definition;
  const prompt = normalizePromptDefinition({
    name: 'Prompt inputs',
    config: {
      schema: [
        { name: 'customer', type: 'string' },
        { name: 'count', type: 'number' },
        { name: 'region', type: 'string' },
        {
          name: 'tone',
          type: 'string',
          validations: [{ type: 'default', value: 'warm' }],
        },
      ],
    },
  }).definition;
  expect(
    inspectComposerReadiness(composer, {
      prompts: [{ promptId: 'dependency', definition: prompt }],
    }).map((entry) => entry.code),
  ).toEqual(['incompatible_dependency_input', 'missing_dependency_input']);
  composer.config.schema[1].type = 'number';
  composer.config.schema[2].validations = [];
  expect(
    inspectComposerReadiness(composer, {
      prompts: [{ promptId: 'dependency', definition: prompt }],
    }),
  ).toEqual([]);
});

test('publication checks real prompt interpolation and snippet inputs without requiring saved sample values', () => {
  const { definition } = normalizePromptDefinition({
    name: 'Welcome email',
    systemMessage: `Welcome \${customer.name}`,
    userMessage: `Use \${tone}. This literal {{example}} is not a prompt variable.`,
    config: {
      schema: [
        { name: 'customer', type: 'object' },
        { name: 'tone', type: 'string' },
      ],
      inputData: {},
    },
  });
  expect(inspectPromptReadiness(definition)).toEqual([]);
  const result = inspectPromptReadiness(definition, {
    snippets: [
      {
        snippetId: 'footer',
        content: `Contact \${support.email}. \${support.email}`,
      },
    ],
  });
  expect(result).toEqual([
    expect.objectContaining({
      code: 'undeclared_variable',
      path: ['snippets', 'footer'],
      severity: 'error',
    }),
  ]);
});

test('composer publication detects renamed variable paths and unresolved link variables inside raw HTML blocks', () => {
  const raw =
    '<span data-variable-ref="" data-field-id="customer-id" data-field-path="oldName"></span><a href="https://example.com/{{missing}}">Link</a>';
  const encoded = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&amp;lt;')
    .replace(/>/g, '&amp;gt;')
    .replace(/"/g, '&quot;');
  const { definition } = normalizeComposerDefinition({
    name: 'Welcome composer',
    content: `<div data-html-block="" data-raw-html="${encoded}"></div>`,
    config: {
      schema: [{ id: 'customer-id', name: 'customer', type: 'string' }],
    },
  });
  expect(
    inspectComposerReadiness(definition).map((entry) => entry.code),
  ).toEqual(['variable_path_mismatch', 'undeclared_variable']);
  definition.content =
    '<span data-variable-ref="" data-field-id="customer-id" data-field-path="customer"></span>';
  expect(inspectComposerReadiness(definition)).toEqual([]);
  definition.content = '<span data-prompt-ref="" data-prompt-id=""></span>';
  expect(inspectComposerReadiness(definition)).toContainEqual(
    expect.objectContaining({ code: 'malformed_prompt_reference' }),
  );
});

test('publication diagnoses malformed nested schema rules while preserving unevaluated custom code', () => {
  const { definition } = normalizePromptDefinition({
    name: 'Schema checks',
    config: {
      schema: [
        { name: 'mode', type: 'enum' },
        {
          name: 'title',
          type: 'string',
          validations: [
            { type: 'regex', value: '[' },
            { type: 'min', value: '-1' },
            {
              type: 'transform',
              transform: '(() => { throw new Error("never execute"); })()',
            },
          ],
        },
        {
          name: 'shape',
          type: 'union',
          params: {
            isDiscriminatedUnion: true,
            discriminatedUnion: {
              discriminator: 'kind',
              cases: {
                one: {
                  value: 'same',
                  fields: [{ name: 'kind', type: 'string' }],
                },
                two: {
                  value: 'same',
                  fields: [{ name: 'value', type: 'unsupportedType' }],
                },
              },
            },
          },
        },
      ],
    },
  });
  expect(inspectPromptReadiness(definition).map((entry) => entry.code)).toEqual(
    [
      'empty_enum',
      'invalid_regular_expression',
      'invalid_validation_value',
      'discriminator_redefined',
      'duplicate_union_case',
      'unknown_field_type',
    ],
  );
});
