import {
  assertAuthoringJson,
  normalizeComposerDefinition,
  normalizePromptDefinition,
  parsePromptDefinition,
} from '../../app/lib/authoring/normalize';
import { AuthoringError } from '../../app/lib/authoring/types';
import { AUTHORING_LIMITS } from '../../app/lib/validations/authoring';
import { expect, test } from '../fixtures/base';

test('authoring normalization preserves saved settings and IDs while assigning IDs to new nested fields and rules', () => {
  const existing = {
    id: 'existing-id',
    name: 'customer',
    type: 'string',
    validations: [
      { id: 'existing-rule', type: 'min', value: '1', message: 'Required' },
    ],
    params: { description: 'Customer name', customSetting: { keep: true } },
    futureFieldSetting: ['preserve'],
  };
  const input = {
    name: 'Prompt',
    systemMessage: '  Preserve whitespace\n',
    config: {
      schema: [
        existing,
        {
          name: 'choice',
          type: 'union',
          validations: [],
          params: {
            isDiscriminatedUnion: true,
            discriminatedUnion: {
              discriminator: 'kind',
              cases: {
                first: {
                  value: 'first',
                  fields: [
                    {
                      name: 'value',
                      type: 'number',
                      validations: [{ type: 'positive' }],
                      params: {},
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      providerOptions: { openai: { reasoningEffort: 'high' } },
      inputData: { customer: 'Name' },
      inputDataRootName: 'payload',
    },
  };
  const before = JSON.stringify(input);
  const result = normalizePromptDefinition(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(result.definition.systemMessage).toBe('  Preserve whitespace\n');
  expect(result.definition.config.schema[0]).toEqual(existing);
  expect(result.definition.config.providerOptions).toEqual({
    openai: { reasoningEffort: 'high' },
  });
  expect(result.assignedIds.map((entry) => entry.kind)).toEqual([
    'field',
    'field',
    'validation',
  ]);
  expect(new Set(result.assignedIds.map((entry) => entry.id)).size).toBe(3);
  expect(normalizePromptDefinition(result.definition).assignedIds).toEqual([]);
  expect(parsePromptDefinition(result.definition).definition).toEqual(
    result.definition,
  );
});

test('authoring preserves legacy schema params, validation cases and code strings without executing them', () => {
  const input = {
    name: 'Legacy prompt',
    config: {
      schema: [
        {
          id: 'field',
          name: 'example',
          type: 'custom',
          validations: [
            {
              id: 'rule',
              type: 'transform',
              value: '',
              message: '',
              transform: 'globalThis.untrustedTransformWasExecuted = true',
              cases: { one: [{ name: 'nested', type: 'string' }] },
            },
          ],
          params: {
            required_error: 'Required',
            invalid_type_error: 'Wrong type',
            stringOptions: { datetime: { offset: true, precision: -1 } },
            functionParams: [
              { name: 'argument', type: 'string', optional: true },
            ],
            legacyOption: 'keep',
          },
        },
      ],
    },
  };
  const result = normalizePromptDefinition(input);
  expect(result.assignedIds).toHaveLength(1);
  expect(result.definition.config.schema[0].validations[0].transform).toBe(
    'globalThis.untrustedTransformWasExecuted = true',
  );
  expect(
    Reflect.get(globalThis, 'untrustedTransformWasExecuted'),
  ).toBeUndefined();
  expect(result.definition.config.schema[0].params).toEqual(
    input.config.schema[0].params,
  );
});

test('authoring allows incomplete fields and missing composer variables without repointing references', () => {
  const content =
    '<p><span data-variable-ref="" data-field-id="missing" data-field-path="customer"></span></p>';
  const result = normalizeComposerDefinition({
    name: 'Composer',
    content,
    config: { schema: [{ id: 'kept', name: '', type: 'string' }] },
  });
  expect(result.definition.content).toBe(content);
  expect(result.definition.config.schema[0].id).toBe('kept');
  expect(result.diagnostics.map((item) => item.code)).toEqual([
    'unnamed_field',
    'unresolved_variable',
  ]);
});

test('authoring preserves encoded raw HTML and rejects contradictory pins for repeated prompts', () => {
  const inner =
    '<span data-prompt-ref="" data-prompt-id="prompt" data-prompt-version-id="v1"></span>';
  const encoded = inner
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&amp;lt;')
    .replaceAll('>', '&amp;gt;')
    .replaceAll('"', '&quot;');
  const content = `<div data-html-block="" data-raw-html="${encoded}"></div>`;
  const result = normalizeComposerDefinition({ name: 'Composer', content });
  expect(result.definition.content).toBe(content);
  expect(result.promptReferences).toEqual([
    { promptId: 'prompt', promptVersionId: 'v1', autoUpdate: false },
  ]);
  expect(() =>
    normalizeComposerDefinition({
      name: 'Composer',
      content: `${content}<span data-prompt-ref="" data-prompt-id="prompt"></span>`,
    }),
  ).toThrow(AuthoringError);
});

test('authoring rejects malformed structures and duplicate IDs or snippet references instead of dropping them', () => {
  for (const input of [
    { name: 'Prompt', unexpected: 'do not drop' },
    { name: 'Prompt', config: [] },
    {
      name: 'Prompt',
      config: {
        schema: [
          { id: 'same', name: 'a', type: 'string' },
          { id: 'same', name: 'b', type: 'number' },
        ],
      },
    },
    { name: 'Prompt', config: { schema: [{ name: 'a', type: 1 }] } },
    {
      name: 'Prompt',
      snippets: [
        { snippetId: 'same', sortOrder: 0 },
        { snippetId: 'same', sortOrder: 1 },
      ],
    },
    {
      name: 'Prompt',
      config: { schema: [{ id: null, name: 'a', type: 'string' }] },
    },
  ])
    expect(() => normalizePromptDefinition(input)).toThrow(AuthoringError);
  expect(() =>
    parsePromptDefinition({
      name: 'Legacy',
      config: { schema: [{ name: 'missing id', type: 'string' }] },
    }),
  ).toThrow(AuthoringError);
});

test('authoring bounds UTF-8 payload size, nested field count, JSON depth and non-JSON values', () => {
  const overLimit = '漢'.repeat(Math.ceil(AUTHORING_LIMITS.contentBytes / 3));
  expect(() =>
    normalizePromptDefinition({ name: 'Large', systemMessage: overLimit }),
  ).toThrow(AuthoringError);
  let nested: unknown = null;
  for (let i = 0; i < AUTHORING_LIMITS.jsonDepth + 1; i += 1)
    nested = { child: nested };
  expect(() => assertAuthoringJson(nested)).toThrow(AuthoringError);
  const cyclic: { child?: unknown } = {};
  cyclic.child = cyclic;
  for (const input of [
    cyclic,
    { value: Number.NaN },
    { value: new Date() },
    { value: undefined },
    Array(3),
  ])
    expect(() => assertAuthoringJson(input)).toThrow(AuthoringError);
  const fields = Array.from(
    { length: AUTHORING_LIMITS.schemaFields + 1 },
    (_, i) => ({ name: `field-${i}`, type: 'string' }),
  );
  expect(() =>
    normalizePromptDefinition({
      name: 'Many fields',
      config: { schema: fields },
    }),
  ).toThrow(AuthoringError);
});
