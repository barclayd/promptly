import { buildZodSchema } from '../build-zod-schema';
import { reconstructFullData } from '../input-data-utils';
import type { SchemaField } from '../schema-types';
import { AUTHORING_LIMITS } from '../validations/authoring';
import { assertAuthoringJson } from './normalize';
import type { AuthoringDiagnostic } from './types';

const diagnostic = (
  code: string,
  path: (string | number)[],
  message: string,
): AuthoringDiagnostic => ({ code, path, message, severity: 'error' });
const simpleTypes = new Set([
  'string',
  'number',
  'boolean',
  'date',
  'bigint',
  'null',
  'undefined',
  'any',
  'unknown',
]);
const runtimeTypes = new Set([
  ...simpleTypes,
  'void',
  'never',
  'nan',
  'literal',
  'enum',
  'array',
  'object',
  'record',
  'map',
  'set',
  'union',
  'intersection',
  'tuple',
  'symbol',
]);
const stringRules = new Set([
  'email',
  'url',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'startsWith',
  'endsWith',
  'datetime',
  'trim',
  'toLowerCase',
  'toUpperCase',
]);
const numberRules = new Set([
  'int',
  'positive',
  'negative',
  'multipleOf',
  'finite',
  'safe',
]);
const wrappers = new Set([
  'optional',
  'nullable',
  'nullish',
  'default',
  'catch',
  'readonly',
]);
const valuedRules = new Set([
  'min',
  'max',
  'length',
  'multipleOf',
  'startsWith',
  'endsWith',
  'default',
  'catch',
]);
const metadataParams = ['description', 'invalid_type_error', 'required_error'];
const knownParams = new Set([
  ...metadataParams,
  'ipVersion',
  'coerce',
  'enumValues',
  'unionTypes',
  'isStrict',
  'isPassthrough',
  'pickOmitFields',
  'pickOmitType',
  'elementType',
  'keyType',
  'valueType',
  'isTuple',
  'tupleTypes',
  'isAsync',
  'isDiscriminatedUnion',
  'discriminator',
  'functionParams',
  'returnType',
  'stringOptions',
  'timezoneOptions',
  'discriminatedUnion',
]);
const ruleOptions = new Set([
  'transform',
  'keyType',
  'valueType',
  'discriminator',
  'cases',
]);
const active = (value: unknown): boolean =>
  value !== undefined &&
  value !== false &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0) &&
  !(
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).length === 0
  );

const inspectRuntimeSchema = (
  fields: readonly SchemaField[],
  prefix: (string | number)[] = ['config', 'schema'],
): AuthoringDiagnostic[] => {
  const diagnostics: AuthoringDiagnostic[] = [];
  const unsupported = (path: (string | number)[], reason: string) =>
    diagnostics.push(
      diagnostic(
        'input_validation_unsupported',
        path,
        `${reason} The saved definition is preserved; this preview cannot fully validate its input.`,
      ),
    );
  const names = new Set<string>();
  for (const [index, field] of fields.entries()) {
    const path = [...prefix, index];
    if (names.has(field.name))
      unsupported([...path, 'name'], 'Duplicate field names are ambiguous.');
    names.add(field.name);
    if (!runtimeTypes.has(field.type))
      unsupported(
        [...path, 'type'],
        `Server validation does not support ${field.type}.`,
      );
    for (const key of Object.keys(field))
      if (!['id', 'name', 'type', 'validations', 'params'].includes(key))
        unsupported(
          [...path, key],
          `Server validation does not interpret field option ${key}.`,
        );
    const params = field.params;
    const allowedParams = new Set(metadataParams);
    const subtype = (
      key: 'elementType' | 'keyType' | 'valueType',
      fallback: string,
    ) => {
      allowedParams.add(key);
      if (!simpleTypes.has(params[key] || fallback))
        unsupported(
          [...path, 'params', key],
          `Nested type ${params[key]} would not be checked by the current schema compiler.`,
        );
    };
    const subtypeList = (
      key: 'tupleTypes' | 'unionTypes',
      minimum: number,
      maximum = Number.POSITIVE_INFINITY,
    ) => {
      allowedParams.add(key);
      const types = params[key] ?? [];
      if (types.length < minimum || types.length > maximum)
        unsupported(
          [...path, 'params', key],
          'The declared type list cannot be faithfully compiled.',
        );
      types.forEach((type, typeIndex) => {
        if (!simpleTypes.has(type))
          unsupported(
            [...path, 'params', key, typeIndex],
            `Nested type ${type} would not be checked by the current schema compiler.`,
          );
      });
    };
    if (['string', 'number', 'boolean', 'date', 'bigint'].includes(field.type))
      allowedParams.add('coerce');
    if (field.type === 'string') {
      allowedParams.add('stringOptions');
      for (const [key, value] of Object.entries(params.stringOptions ?? {})) {
        if (
          !['datetime', 'ip'].includes(key) ||
          !field.validations.some((rule) => rule.type === key)
        ) {
          if (!['datetime', 'ip'].includes(key) || active(value))
            unsupported(
              [...path, 'params', 'stringOptions', key],
              'These string options are not applied by the declared validations.',
            );
        } else {
          const keys =
            key === 'datetime' ? ['offset', 'precision'] : ['version'];
          for (const option of Object.keys(value ?? {}))
            if (!keys.includes(option))
              unsupported(
                [...path, 'params', 'stringOptions', key, option],
                'This string option is not interpreted by server validation.',
              );
        }
      }
      const precision = params.stringOptions?.datetime?.precision;
      if (
        precision !== undefined &&
        (!Number.isInteger(precision) || precision < -1 || precision > 100)
      )
        unsupported(
          [...path, 'params', 'stringOptions', 'datetime', 'precision'],
          'Datetime precision is outside the bounded range supported by preview.',
        );
    }
    if (['literal', 'enum'].includes(field.type)) {
      allowedParams.add('enumValues');
      if (
        !params.enumValues?.length ||
        (field.type === 'literal' && params.enumValues.length !== 1)
      )
        unsupported(
          [...path, 'params', 'enumValues'],
          'Literal and enum values must explicitly describe the compiled allowed values.',
        );
    }
    if (field.type === 'array') {
      allowedParams.add('isTuple');
      if (params.isTuple) subtypeList('tupleTypes', 1);
      else subtype('elementType', 'any');
    }
    if (field.type === 'tuple') subtypeList('tupleTypes', 0);
    if (field.type === 'object') {
      allowedParams.add('isStrict');
      allowedParams.add('isPassthrough');
      if (params.isStrict && params.isPassthrough)
        unsupported(
          [...path, 'params'],
          'Strict and passthrough object options conflict.',
        );
    }
    if (['record', 'map'].includes(field.type)) {
      subtype('keyType', 'string');
      subtype('valueType', 'any');
    }
    if (field.type === 'set') subtype('elementType', 'any');
    if (field.type === 'intersection') subtypeList('unionTypes', 2, 2);
    if (field.type === 'union') {
      allowedParams.add('isDiscriminatedUnion');
      if (!params.isDiscriminatedUnion) subtypeList('unionTypes', 2);
      else {
        allowedParams.add('discriminatedUnion');
        const union = params.discriminatedUnion;
        if (!union?.discriminator || !Object.keys(union.cases).length)
          unsupported(
            [...path, 'params', 'discriminatedUnion'],
            'A discriminated union needs a discriminator and cases.',
          );
        if (union) {
          for (const key of Object.keys(union))
            if (!['discriminator', 'cases'].includes(key))
              unsupported(
                [...path, 'params', 'discriminatedUnion', key],
                'This union option is not interpreted by server validation.',
              );
          const values = new Set<string>();
          for (const [key, entry] of Object.entries(union.cases)) {
            const casePath = [
              ...path,
              'params',
              'discriminatedUnion',
              'cases',
              key,
            ];
            if (
              values.has(entry.value) ||
              entry.fields.some((child) => child.name === union.discriminator)
            )
              unsupported(
                casePath,
                'The discriminated union has conflicting case definitions.',
              );
            values.add(entry.value);
            for (const option of Object.keys(entry))
              if (!['value', 'fields'].includes(option))
                unsupported(
                  [...casePath, option],
                  'This case option is not interpreted by server validation.',
                );
            diagnostics.push(
              ...inspectRuntimeSchema(entry.fields, [...casePath, 'fields']),
            );
          }
        }
      }
    }
    for (const [key, value] of Object.entries(params))
      if (!allowedParams.has(key) && (!knownParams.has(key) || active(value)))
        unsupported(
          [...path, 'params', key],
          `The current schema compiler does not apply ${key} to ${field.type}.`,
        );
    let wrapped = false;
    const isArray = field.type === 'array' && !params.isTuple;
    for (const [ruleIndex, rule] of field.validations.entries()) {
      const rulePath = [...path, 'validations', ruleIndex];
      for (const [key, value] of Object.entries(rule))
        if (
          !['id', 'type', 'message', 'value'].includes(key) &&
          (!ruleOptions.has(key) || active(value))
        )
          unsupported(
            [...rulePath, key],
            `Server validation does not interpret rule option ${key}.`,
          );
      if (!valuedRules.has(rule.type) && rule.value !== '')
        unsupported(
          [...rulePath, 'value'],
          `The current schema compiler does not use a value for ${rule.type}.`,
        );
      if (wrappers.has(rule.type)) {
        if (
          ['default', 'catch'].includes(rule.type) &&
          (rule.value === '' ||
            !['string', 'number'].includes(field.type) ||
            (field.type === 'number' && !Number.isFinite(Number(rule.value))))
        )
          unsupported(
            rulePath,
            'This fallback value cannot be faithfully compiled.',
          );
        wrapped = true;
        continue;
      }
      if (wrapped) {
        unsupported(
          rulePath,
          'A validation after a wrapper or IP validator is not consistently applied by the current schema compiler.',
        );
        continue;
      }
      if (rule.type === 'ip') {
        if (field.type !== 'string' || ruleIndex !== 0 || params.coerce)
          unsupported(
            rulePath,
            'IP validation would discard a preceding type, coercion, or constraint.',
          );
        wrapped = true;
        continue;
      }
      if (stringRules.has(rule.type)) {
        if (field.type !== 'string')
          unsupported(
            rulePath,
            `${rule.type} is not applied to ${field.type}.`,
          );
        continue;
      }
      if (numberRules.has(rule.type) && field.type === 'number') {
        if (
          rule.type === 'multipleOf' &&
          (!rule.value.trim() ||
            !Number.isFinite(Number(rule.value)) ||
            Number(rule.value) <= 0)
        )
          unsupported(
            rulePath,
            'A multipleOf bound must be finite and positive.',
          );
        continue;
      }
      if (['min', 'max', 'length', 'nonempty'].includes(rule.type)) {
        const supported =
          rule.type === 'length'
            ? field.type === 'string' || isArray
            : rule.type === 'nonempty'
              ? field.type === 'string' || isArray || field.type === 'set'
              : ['string', 'number', 'set'].includes(field.type) || isArray;
        if (!supported)
          unsupported(
            rulePath,
            `${rule.type} cannot be faithfully applied to ${field.type}.`,
          );
        if (rule.type !== 'nonempty') {
          const value = Number(rule.value);
          if (
            !rule.value.trim() ||
            !Number.isFinite(value) ||
            (field.type !== 'number' &&
              (!Number.isSafeInteger(value) || value < 0))
          )
            unsupported(
              rulePath,
              'This validation bound cannot be faithfully compiled.',
            );
        }
        continue;
      }
      unsupported(
        rulePath,
        `Server validation does not execute or verify ${rule.type}.`,
      );
    }
  }
  return diagnostics;
};

export const validateAuthoringInput = (
  fields: readonly SchemaField[],
  data: unknown,
  rootName: string | null = null,
): AuthoringDiagnostic[] => {
  assertAuthoringJson(data, AUTHORING_LIMITS.sampleBytes);
  const diagnostics = inspectRuntimeSchema(fields);
  if (diagnostics.length) return diagnostics;
  try {
    const result = buildZodSchema([...fields]).safeParse(
      reconstructFullData(data, rootName),
    );
    if (!result.success)
      diagnostics.push(
        ...result.error.issues.map((issue) =>
          diagnostic(
            'invalid_input_data',
            [
              'inputData',
              ...issue.path.map((part) =>
                typeof part === 'symbol' ? String(part) : part,
              ),
            ],
            issue.message,
          ),
        ),
      );
  } catch {
    diagnostics.push(
      diagnostic(
        'input_validation_unavailable',
        ['config', 'schema'],
        'This schema cannot be validated by the server preview. Review its field types and rules.',
      ),
    );
  }
  return diagnostics;
};
