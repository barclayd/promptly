import { createHash } from 'node:crypto';
import {
  applyComposerEdits,
  applyPromptEdits,
  canonicalAuthoringRequestHash,
} from '../../app/lib/authoring/edits';
import {
  normalizeComposerDefinition,
  normalizePromptDefinition,
} from '../../app/lib/authoring/normalize';
import { AuthoringError } from '../../app/lib/authoring/types';
import {
  authoringSchemasEqual,
  parseAuthoringVersion,
  selectAuthoringPublishVersion,
  suggestAuthoringVersion,
} from '../../app/lib/authoring/versioning';
import {
  composerAuthoringEditSchema,
  promptAuthoringEditSchema,
  promptSubmittedDefinitionSchema,
} from '../../app/lib/validations/authoring';
import { expect, test } from '../fixtures/base';

test('partial authoring edits preserve omitted fields and merge configuration at the key boundary', () => {
  const current = normalizePromptDefinition({
    name: 'Original',
    description: 'Keep description',
    systemMessage: 'Keep system',
    userMessage: 'Keep user',
    labels: 'keep',
    config: {
      model: 'gpt-5.5',
      temperature: 1.2,
      inputData: { name: 'Example' },
      providerOptions: { old: true },
      futureSetting: ['keep'],
    },
    snippets: [{ snippetId: 'snippet', sortOrder: 3 }],
  }).definition;
  const before = JSON.stringify(current);
  const result = applyPromptEdits(current, {
    mode: 'patch',
    changes: {
      name: 'Updated',
      config: { model: null, providerOptions: { replacement: true } },
    },
  });
  expect(result.definition).toEqual({
    ...current,
    name: 'Updated',
    config: {
      ...current.config,
      model: null,
      providerOptions: { replacement: true },
    },
  });
  expect(JSON.stringify(current)).toBe(before);
  expect(result.assignedIds).toEqual([]);
  expect(
    applyPromptEdits(current, { mode: 'patch', changes: { config: {} } })
      .definition,
  ).toEqual(current);
  expect(
    applyPromptEdits(current, {
      mode: 'patch',
      changes: { labels: null, snippets: [], systemMessage: '' },
    }).definition,
  ).toMatchObject({
    labels: null,
    snippets: [],
    systemMessage: '',
    userMessage: 'Keep user',
  });
});

test('authoring schema edits accept omitted nested IDs but retain existing identities', () => {
  const current = normalizePromptDefinition({
    name: 'Prompt',
    config: { schema: [{ id: 'existing', name: 'kept', type: 'string' }] },
  }).definition;
  const edit = {
    mode: 'patch' as const,
    changes: {
      config: {
        schema: [
          ...current.config.schema,
          {
            name: 'new',
            type: 'union',
            params: {
              discriminatedUnion: {
                discriminator: 'kind',
                cases: {
                  example: {
                    value: 'example',
                    fields: [
                      {
                        name: 'nested',
                        type: 'string',
                        validations: [{ type: 'min', value: '1' }],
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    },
  };
  expect(promptAuthoringEditSchema.safeParse(edit).success).toBe(true);
  expect(
    promptSubmittedDefinitionSchema.safeParse({
      name: 'Create prompt',
      config: edit.changes.config,
    }).success,
  ).toBe(true);
  const result = applyPromptEdits(current, edit);
  expect(result.definition.config.schema[0].id).toBe('existing');
  expect(result.assignedIds.map((entry) => entry.kind)).toEqual([
    'field',
    'field',
    'validation',
  ]);
});

test('full authoring replacement resets omitted fields to defaults and preserves supplied reference IDs', () => {
  const current = normalizePromptDefinition({
    name: 'Old prompt',
    description: 'Old description',
    userMessage: 'Old content',
    config: { model: 'gpt-5.5' },
    snippets: [{ snippetId: 'snippet', sortOrder: 0 }],
  }).definition;
  const result = applyPromptEdits(current, {
    mode: 'replace',
    definition: { name: 'Replacement', systemMessage: 'New content' },
  });
  expect(result.definition).toEqual(
    normalizePromptDefinition({
      name: 'Replacement',
      systemMessage: 'New content',
    }).definition,
  );
  const composer = normalizeComposerDefinition({
    name: 'Old composer',
    content: '<p>Old content</p>',
  }).definition;
  const content =
    '<span data-variable-ref="" data-field-id="existing" data-field-path="name"></span>';
  const replaced = applyComposerEdits(composer, {
    mode: 'replace',
    definition: {
      name: 'Replacement',
      content,
      config: { schema: [{ id: 'existing', name: 'name', type: 'string' }] },
    },
  });
  expect(replaced.definition.content).toBe(content);
  expect(replaced.assignedIds).toEqual([]);
});

test('targeted authoring replacements use exact original positions and literal replacement text', () => {
  const current = normalizePromptDefinition({
    name: 'Prompt',
    systemMessage: 'first middle last',
    userMessage: 'separate field',
  }).definition;
  const edit = {
    mode: 'patch' as const,
    replacements: [
      {
        field: 'systemMessage' as const,
        oldText: 'first',
        newText: 'last $& $1 \\',
      },
      { field: 'systemMessage' as const, oldText: 'last', newText: 'FINAL' },
      { field: 'userMessage' as const, oldText: 'separate', newText: '' },
    ],
  };
  expect(applyPromptEdits(current, edit).definition).toMatchObject({
    systemMessage: 'last $& $1 \\ middle FINAL',
    userMessage: ' field',
  });
  expect(
    applyPromptEdits(current, {
      ...edit,
      replacements: edit.replacements.toReversed(),
    }).definition,
  ).toEqual(applyPromptEdits(current, edit).definition);
  expect(current.systemMessage).toBe('first middle last');
  const composer = normalizeComposerDefinition({
    name: 'Composer',
    content: '<p>Before &amp; after</p>',
  }).definition;
  expect(
    applyComposerEdits(composer, {
      mode: 'patch',
      replacements: [
        {
          field: 'content',
          oldText: 'Before &amp;',
          newText: '<strong>New</strong>',
        },
      ],
    }).definition.content,
  ).toBe('<p><strong>New</strong> after</p>');
});

test('targeted authoring edits reject absent, ambiguous, overlapping and contradictory replacements', () => {
  const current = normalizePromptDefinition({
    name: 'Prompt',
    systemMessage: 'abc abc unique',
    userMessage: 'aaa',
  }).definition;
  for (const edit of [
    {
      mode: 'patch' as const,
      replacements: [
        { field: 'systemMessage' as const, oldText: 'missing', newText: '' },
      ],
    },
    {
      mode: 'patch' as const,
      replacements: [
        { field: 'systemMessage' as const, oldText: 'abc', newText: '' },
      ],
    },
    {
      mode: 'patch' as const,
      replacements: [
        { field: 'userMessage' as const, oldText: 'aa', newText: '' },
      ],
    },
    {
      mode: 'patch' as const,
      replacements: [
        { field: 'systemMessage' as const, oldText: 'unique', newText: '' },
        { field: 'systemMessage' as const, oldText: 'nique', newText: '' },
      ],
    },
    {
      mode: 'patch' as const,
      changes: { systemMessage: 'Changed' },
      replacements: [
        { field: 'systemMessage' as const, oldText: 'unique', newText: '' },
      ],
    },
    {
      mode: 'patch' as const,
      replacements: [
        {
          field: 'systemMessage' as const,
          oldText: 'unique',
          newText: 'generated',
        },
        {
          field: 'systemMessage' as const,
          oldText: 'generated',
          newText: 'chained',
        },
      ],
    },
  ])
    expect(() => applyPromptEdits(current, edit)).toThrow(AuthoringError);
  expect(
    promptAuthoringEditSchema.safeParse({
      mode: 'patch',
      replacements: [
        { field: 'systemMessage', oldText: '', newText: 'append' },
      ],
    }).success,
  ).toBe(false);
  expect(
    composerAuthoringEditSchema.safeParse({
      mode: 'replace',
      definition: { name: 'Composer' },
      replacements: [],
    }).success,
  ).toBe(false);
});

test('authoring patch schemas allow null only for saved fields that support it', () => {
  for (const changes of [
    { name: null },
    { description: null },
    { systemMessage: null },
    { snippets: null },
    { config: null },
    { config: { temperature: null } },
    { config: { schema: null } },
  ])
    expect(
      promptAuthoringEditSchema.safeParse({ mode: 'patch', changes }).success,
    ).toBe(false);
  expect(
    promptAuthoringEditSchema.safeParse({
      mode: 'patch',
      changes: {
        labels: null,
        config: { model: null, inputData: null, inputDataRootName: null },
      },
    }).success,
  ).toBe(true);
  expect(
    promptAuthoringEditSchema.parse({
      mode: 'patch',
      changes: { config: { model: null } },
    }),
  ).toEqual({ mode: 'patch', changes: { config: { model: null } } });
});

test('authoring request hashes canonicalize object keys before assigning IDs and preserve meaningful differences', async () => {
  const one = {
    expectedRevision: 'revision-1',
    id: 'prompt',
    edit: {
      mode: 'patch',
      changes: { config: { schema: [{ name: 'new', type: 'string' }] } },
    },
  };
  const two = {
    edit: {
      changes: { config: { schema: [{ type: 'string', name: 'new' }] } },
      mode: 'patch',
    },
    id: 'prompt',
    expectedRevision: 'revision-1',
  };
  const before = JSON.stringify(one);
  const hash = await canonicalAuthoringRequestHash(one);
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  expect(await canonicalAuthoringRequestHash(two)).toBe(hash);
  expect(JSON.stringify(one)).toBe(before);
  for (const intent of [
    { ...one, id: 'different' },
    { ...one, expectedRevision: 'revision-2' },
    { ...one, version: null },
    { array: [1, 2] },
    { array: [2, 1] },
  ])
    expect(await canonicalAuthoringRequestHash(intent)).not.toBe(hash);
  expect(await canonicalAuthoringRequestHash({ b: 2, a: [1, 'text'] })).toBe(
    createHash('sha256').update('{"a":[1,"text"],"b":2}').digest('hex'),
  );
  await expect(
    canonicalAuthoringRequestHash({ invalid: undefined }),
  ).rejects.toBeInstanceOf(AuthoringError);
});

test('authoring version suggestions match the existing top-level schema comparison rules', () => {
  const schema = normalizePromptDefinition({
    name: 'Prompt',
    config: {
      schema: [
        { id: 'a', name: 'alpha', type: 'string' },
        { id: 'b', name: 'beta', type: 'number' },
      ],
    },
  }).definition.config.schema;
  expect(
    suggestAuthoringVersion({ currentSchema: schema, latestPublished: null }),
  ).toEqual({ major: 1, minor: 0, patch: 0, version: '1.0.0' });
  expect(authoringSchemasEqual(schema, schema.toReversed())).toBe(true);
  expect(
    suggestAuthoringVersion({
      currentSchema: schema.toReversed(),
      latestPublished: { version: '2.3.7', schema },
    }).version,
  ).toBe('2.4.7');
  const changed = schema.map((field) => ({
    ...field,
    name: `${field.name}-changed`,
  }));
  expect(
    suggestAuthoringVersion({
      currentSchema: changed,
      latestPublished: { version: '2.3.7', schema },
    }).version,
  ).toBe('3.0.0');
  expect(
    authoringSchemasEqual(
      schema,
      schema.map((field) => ({ ...field, id: `${field.id}-new` })),
    ),
  ).toBe(false);
  expect(schema.map((field) => field.name)).toEqual(['alpha', 'beta']);
});

test('authoring semver overrides must be canonical safe integers and strictly increase', () => {
  for (const value of [
    '01.2.3',
    '1.02.3',
    '1.2.03',
    '1.2',
    'v1.2.3',
    '1.2.3-beta',
    '1.2.3+build',
    '1.2.3 ',
    '1e2.0.0',
    '9007199254740992.0.0',
    '-1.0.0',
  ])
    expect(() => parseAuthoringVersion(value)).toThrow(AuthoringError);
  const input = {
    currentSchema: [],
    latestPublished: { version: '2.3.7', schema: [] },
  };
  for (const override of ['2.3.7', '2.3.6', '1.99.99'])
    expect(() => selectAuthoringPublishVersion({ ...input, override })).toThrow(
      AuthoringError,
    );
  for (const override of ['2.3.8', '2.4.0', '3.0.0'])
    expect(selectAuthoringPublishVersion({ ...input, override }).version).toBe(
      override,
    );
  expect(
    selectAuthoringPublishVersion({
      currentSchema: [],
      latestPublished: null,
      override: '0.1.0',
    }).version,
  ).toBe('0.1.0');
  expect(() =>
    suggestAuthoringVersion({
      currentSchema: [],
      latestPublished: { version: '1.9007199254740991.0', schema: [] },
    }),
  ).toThrow(AuthoringError);
});
