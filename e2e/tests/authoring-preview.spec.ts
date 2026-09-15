import {
  normalizeComposerDefinition,
  normalizePromptDefinition,
} from '../../app/lib/authoring/normalize';
import {
  prepareComposerPreview,
  preparePromptPreview,
  validateAuthoringInput,
} from '../../app/lib/authoring/preview';
import { getNestedValue } from '../../app/lib/prompt-interpolation';
import { expect, test } from '../fixtures/base';

test('prompt preview resolves ordered snippets and explicit nested inputs using existing unused-data behavior', () => {
  const definition = normalizePromptDefinition({
    name: 'Welcome',
    systemMessage: `Hello \${customer.name}`,
    userMessage: `Tone: \${tone}`,
    config: {
      schema: [
        { name: 'customer', type: 'object' },
        { name: 'tone', type: 'string' },
      ],
      inputData: { customer: { name: 'Saved' }, tone: 'saved' },
    },
  }).definition;
  const result = preparePromptPreview(
    definition,
    {
      source: 'supplied',
      data: { customer: { name: 'Dan' }, tone: 'warm', extra: 1 },
    },
    [
      { snippetId: 'one', content: 'First' },
      { snippetId: 'two', content: 'Second' },
    ],
  );
  expect(result.valid).toBe(true);
  expect(result.systemMessage).toBe('First\n\nSecond\n\nHello Dan');
  expect(result.userMessage).toBe('Tone: warm\n\n{"extra":1}');
  expect(result.executed).toBe(false);
  expect(preparePromptPreview(definition, { source: 'empty' }).valid).toBe(
    false,
  );
  expect(
    preparePromptPreview(definition, { source: 'saved_sample' }).systemMessage,
  ).toBe('Hello Saved');
});

test('preview diagnoses invalid input without interpreting supplied text as another template', () => {
  const definition = normalizePromptDefinition({
    name: 'Inputs',
    userMessage: `\${name}`,
    config: {
      schema: [
        {
          name: 'name',
          type: 'string',
          validations: [{ type: 'min', value: '2' }],
        },
      ],
    },
  }).definition;
  expect(
    preparePromptPreview(definition, {
      source: 'supplied',
      data: { name: 'a' },
    }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: 'invalid_input_data',
      path: ['inputData', 'name'],
    }),
  );
  const literal = `User wrote \${anExample}`;
  expect(
    preparePromptPreview(definition, {
      source: 'supplied',
      data: { name: literal },
    }),
  ).toMatchObject({ valid: true, userMessage: literal });
  const advanced = normalizePromptDefinition({
    name: 'Custom schema',
    config: {
      schema: [
        {
          name: 'name',
          type: 'string',
          validations: [
            {
              type: 'transform',
              transform: '(() => { throw new Error("do not execute"); })()',
            },
          ],
        },
      ],
    },
  }).definition;
  expect(
    validateAuthoringInput(advanced.config.schema, { name: 'Dan' }),
  ).toContainEqual(
    expect.objectContaining({ code: 'input_validation_unsupported' }),
  );
});

test('composer preview substitutes inputs and exposes explicit unexecuted prompt placeholders including raw blocks', () => {
  const prompt = normalizePromptDefinition({
    name: 'Greeting',
    config: { schema: [{ name: 'customer', type: 'string' }] },
  }).definition;
  const raw =
    '<p>Raw <span data-prompt-ref="" data-prompt-id="greeting"></span></p>';
  const encoded = raw
    .replace(/</g, '&amp;lt;')
    .replace(/>/g, '&amp;gt;')
    .replace(/"/g, '&quot;');
  const composer = normalizeComposerDefinition({
    name: 'Welcome composer',
    content: `<p><span data-variable-ref="" data-field-id="customer" data-field-path="customer"></span></p><div data-html-block="" data-raw-html="${encoded}"></div>`,
    config: { schema: [{ id: 'customer', name: 'customer', type: 'string' }] },
  }).definition;
  const result = prepareComposerPreview(
    composer,
    { source: 'supplied', data: { customer: 'Dan' } },
    [{ promptId: 'greeting', definition: prompt }],
  );
  expect(result.valid).toBe(true);
  expect(result.executed).toBe(false);
  expect(result.segments).toEqual([
    { kind: 'html', html: '<p>Dan</p>' },
    { kind: 'html', html: '<p>Raw ' },
    {
      kind: 'prompt_placeholder',
      promptId: 'greeting',
      label: 'Generated output from Greeting (not executed)',
    },
    { kind: 'html', html: '</p>' },
  ]);
});

test('input paths never read inherited properties or partial array indices', () => {
  expect(
    getNestedValue({ person: {} }, 'person.constructor.name'),
  ).toBeUndefined();
  expect(getNestedValue({ items: ['first'] }, 'items.0oops')).toBeUndefined();
  expect(getNestedValue({ items: ['first'] }, 'items.0')).toBe('first');
  expect(
    getNestedValue(
      JSON.parse('{"person":{"constructor":"own value"}}'),
      'person.constructor',
    ),
  ).toBe('own value');
});

test('composer preview treats supplied template-looking text literally and diagnoses actual missing values', () => {
  const definition = normalizeComposerDefinition({
    name: 'Literal input',
    content:
      '<p><span data-variable-ref="" data-field-id="name" data-field-path="name"></span></p>',
    config: { schema: [{ id: 'name', name: 'name', type: 'string' }] },
  }).definition;
  const literal =
    '{{example}} <span data-field-path="other" data-variable-ref=""></span><a href="{{other}}">data-variable-ref</a>';
  const result = prepareComposerPreview(definition, {
    source: 'supplied',
    data: { name: literal, other: 'must not substitute' },
  });
  expect(result.valid).toBe(true);
  expect(result.segments).toEqual([
    { kind: 'html', html: `<p>${literal}</p>` },
  ]);
  expect(
    prepareComposerPreview(definition, { source: 'empty' }).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: 'unresolved_input_value' }));
});
