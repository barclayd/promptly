import { validateAuthoringInput } from '../../app/lib/authoring/input-validation';
import type { SchemaField, ValidationRule } from '../../app/lib/schema-types';
import { expect, test } from '../fixtures/base';

const rule = (type: string, value = ''): ValidationRule => ({
  id: type,
  type,
  value,
  message: '',
});
const field = (
  type: string,
  params: SchemaField['params'] = {},
  validations: ValidationRule[] = [],
): SchemaField => ({ id: 'field', name: 'value', type, params, validations });

test('authoring input validation enforces supported rules, coercion, bounds, and optional wrappers', () => {
  const text = field('string', {}, [
    rule('trim'),
    rule('min', '3'),
    rule('optional'),
  ]);
  expect(validateAuthoringInput([text], {})).toEqual([]);
  expect(validateAuthoringInput([text], { value: ' yes ' })).toEqual([]);
  expect(validateAuthoringInput([text], { value: ' a ' })).toMatchObject([
    { code: 'invalid_input_data', path: ['inputData', 'value'] },
  ]);
  const numeric = field('number', { coerce: true }, [
    rule('int'),
    rule('min', '2'),
    rule('multipleOf', '2'),
  ]);
  expect(validateAuthoringInput([numeric], { value: '4' })).toEqual([]);
  expect(validateAuthoringInput([numeric], { value: '3' })[0].code).toBe(
    'invalid_input_data',
  );
  expect(
    validateAuthoringInput([field('string', {}, [rule('email')])], {
      value: 'invalid',
    })[0].code,
  ).toBe('invalid_input_data');
  expect(
    validateAuthoringInput(
      [field('string', {}, [rule('default', 'fallback')])],
      {},
    ),
  ).toEqual([]);
  expect(
    validateAuthoringInput([field('number', {}, [rule('catch', '3')])], {
      value: 'invalid',
    }),
  ).toEqual([]);
  expect(
    validateAuthoringInput(
      [
        field(
          'string',
          { stringOptions: { datetime: { offset: true, precision: 0 } } },
          [rule('datetime')],
        ),
      ],
      { value: '2026-09-15T12:00:00+01:00' },
    ),
  ).toEqual([]);
});

test('authoring input validation checks simple collection and union types rather than silently widening nested types', () => {
  expect(
    validateAuthoringInput(
      [field('array', { elementType: 'number' }, [rule('min', '2')])],
      { value: [1, 2] },
    ),
  ).toEqual([]);
  expect(
    validateAuthoringInput([field('array', { elementType: 'number' })], {
      value: [1, 'wrong'],
    })[0].code,
  ).toBe('invalid_input_data');
  expect(
    validateAuthoringInput(
      [field('tuple', { tupleTypes: ['string', 'number'] })],
      { value: ['ok', 3] },
    ),
  ).toEqual([]);
  expect(
    validateAuthoringInput(
      [field('union', { unionTypes: ['string', 'number'] })],
      { value: false },
    )[0].code,
  ).toBe('invalid_input_data');
  expect(
    validateAuthoringInput([field('record', { valueType: 'number' })], {
      value: { one: 'wrong' },
    })[0].code,
  ).toBe('invalid_input_data');
  for (const item of [
    field('array', { elementType: 'object' }),
    field('array', { isTuple: true }),
    field('tuple', { tupleTypes: ['never'] }),
    field('union', { unionTypes: ['string', 'future-type'] }),
    field('intersection', { unionTypes: ['string', 'string', 'number'] }),
    field('map', { valueType: 'object' }),
    field('set', { elementType: 'object' }),
  ])
    expect(
      validateAuthoringInput([item], { value: [] }).some(
        (entry) => entry.code === 'input_validation_unsupported',
      ),
    ).toBe(true);
});

test('authoring input validation reports ignored or unsafe schema combinations without falsely validating them', () => {
  const unsupported = [
    field('string', {}, [rule('optional'), rule('min', '5')]),
    field('number', {}, [rule('readonly'), rule('positive')]),
    field('string', {}, [rule('min', '100'), rule('ip')]),
    field('string', { coerce: true }, [rule('ip')]),
    field('string', {}, [rule('ip'), rule('min', '100')]),
    field('bigint', { coerce: true }, [rule('min', '9007199254740993')]),
    field('date', { coerce: true }, [rule('max', '2026-09-15')]),
    field('set', {}, [rule('size', '3')]),
    field('string', {}, [rule('default')]),
    field('boolean', {}, [rule('catch', 'false')]),
    field('number', {}, [rule('email')]),
    field('object', { isStrict: true, isPassthrough: true }),
    field('object', { pickOmitFields: ['secret'], pickOmitType: 'omit' }),
    field('string', { stringOptions: { datetime: { precision: 10000000 } } }, [
      rule('datetime'),
    ]),
    field('string', {}, [rule('regex', '(a+)+$')]),
    field('string', {}, [rule('transform', 'throw new Error("must not run")')]),
    field('number', {}, [rule('multipleOf', '0')]),
    field(
      'object',
      Object.assign({ isStrict: false }, { allowUnknownProperties: false }),
    ),
    field('string', {}, [
      Object.assign(rule('email'), { allowInvalid: false }),
    ]),
  ];
  const original = JSON.stringify(unsupported);
  for (const item of unsupported) {
    const diagnostics = validateAuthoringInput([item], { value: 'short' });
    expect(
      diagnostics.some(
        (entry) => entry.code === 'input_validation_unsupported',
      ),
    ).toBe(true);
    expect(diagnostics.every((entry) => entry.path[0] === 'config')).toBe(true);
  }
  expect(JSON.stringify(unsupported)).toBe(original);
});

test('authoring input validation checks nested discriminated cases and refuses ignored case options', () => {
  const union = field('union', {
    isDiscriminatedUnion: true,
    discriminatedUnion: {
      discriminator: 'kind',
      cases: {
        email: {
          value: 'email',
          fields: [field('string', {}, [rule('email')])],
        },
        number: {
          value: 'number',
          fields: [field('number', {}, [rule('positive')])],
        },
      },
    },
  });
  expect(
    validateAuthoringInput([union], {
      value: { kind: 'email', value: 'person@example.com' },
    }),
  ).toEqual([]);
  expect(
    validateAuthoringInput([union], {
      value: { kind: 'email', value: 'wrong' },
    })[0].code,
  ).toBe('invalid_input_data');
  const unsafe = structuredClone(union);
  const nested = unsafe.params.discriminatedUnion?.cases.email.fields[0];
  if (!nested) throw new Error('Missing nested fixture');
  nested.validations = [rule('optional'), rule('min', '10')];
  expect(
    validateAuthoringInput([unsafe], { value: { kind: 'email', value: 'x' } }),
  ).toMatchObject([
    {
      code: 'input_validation_unsupported',
      path: [
        'config',
        'schema',
        0,
        'params',
        'discriminatedUnion',
        'cases',
        'email',
        'fields',
        0,
        'validations',
        1,
      ],
    },
  ]);
  const duplicate = [field('string'), field('number')];
  expect(validateAuthoringInput(duplicate, { value: 1 })[0].code).toBe(
    'input_validation_unsupported',
  );
});

test('authoring input validation preserves supplied data while reconstructing a named root', () => {
  const schema = [field('object', { isPassthrough: true })];
  const data = { count: '3' };
  expect(validateAuthoringInput(schema, data, 'value')).toEqual([]);
  expect(data).toEqual({ count: '3' });
  expect(
    validateAuthoringInput([field('string', {}, [rule('ip')])], {
      value: '127.0.0.1',
    }),
  ).toEqual([]);
  expect(
    validateAuthoringInput(
      [field('string', {}, [rule('ip'), rule('optional')])],
      {},
    ),
  ).toEqual([]);
});
