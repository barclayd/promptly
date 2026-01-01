import { z } from 'zod';
import type { SchemaField, ValidationRule } from './schema-types';

export const buildZodSchema = (
  fields: SchemaField[],
): z.ZodObject<z.ZodRawShape> => {
  if (fields.length === 0) {
    return z.object({});
  }

  const shape: z.ZodRawShape = {};

  for (const field of fields) {
    shape[field.name] = buildFieldSchema(field);
  }

  return z.object(shape);
};

const buildFieldSchema = (field: SchemaField): z.ZodTypeAny => {
  let schema = buildBaseType(field);
  schema = applyValidations(schema, field.validations, field);
  return schema;
};

const buildBaseType = (field: SchemaField): z.ZodTypeAny => {
  const { type, params } = field;

  switch (type) {
    case 'string':
      return params.coerce ? z.coerce.string() : z.string();
    case 'number':
      return params.coerce ? z.coerce.number() : z.number();
    case 'boolean':
      return params.coerce ? z.coerce.boolean() : z.boolean();
    case 'date':
      return params.coerce ? z.coerce.date() : z.date();
    case 'bigint':
      return params.coerce ? z.coerce.bigint() : z.bigint();
    case 'null':
      return z.null();
    case 'undefined':
      return z.undefined();
    case 'void':
      return z.void();
    case 'any':
      return z.any();
    case 'unknown':
      return z.unknown();
    case 'never':
      return z.never();
    case 'nan':
      return z.nan();
    case 'literal': {
      const value = params.enumValues?.[0] || '';
      return z.literal(value);
    }
    case 'enum': {
      if (!params.enumValues || params.enumValues.length === 0) {
        return z.enum(['']);
      }
      return z.enum(params.enumValues as [string, ...string[]]);
    }
    case 'array': {
      if (params.isTuple && params.tupleTypes && params.tupleTypes.length > 0) {
        const tupleSchemas = params.tupleTypes.map((t) => getSimpleType(t));
        return z.tuple(tupleSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
      }
      const elementType = params.elementType || 'any';
      return z.array(getSimpleType(elementType));
    }
    case 'object': {
      let objectSchema = z.object({});
      if (params.isStrict) {
        objectSchema = objectSchema.strict();
      }
      if (params.isPassthrough) {
        objectSchema = objectSchema.passthrough();
      }
      return objectSchema;
    }
    case 'record': {
      const keyType = params.keyType || 'string';
      const valueType = params.valueType || 'any';
      return z.record(
        getSimpleType(keyType) as z.ZodString,
        getSimpleType(valueType),
      );
    }
    case 'map': {
      const mapKeyType = params.keyType || 'string';
      const mapValueType = params.valueType || 'any';
      return z.map(getSimpleType(mapKeyType), getSimpleType(mapValueType));
    }
    case 'set': {
      const setValueType = params.elementType || 'any';
      return z.set(getSimpleType(setValueType));
    }
    case 'union': {
      if (params.isDiscriminatedUnion && params.discriminatedUnion) {
        return buildDiscriminatedUnion(params.discriminatedUnion);
      }
      if (!params.unionTypes || params.unionTypes.length === 0) {
        return z.union([z.string(), z.number()]);
      }
      const unionSchemas = params.unionTypes.map((t) => getSimpleType(t));
      return z.union(
        unionSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      );
    }
    case 'intersection':
      if (!params.unionTypes || params.unionTypes.length < 2) {
        return z.intersection(z.object({}), z.object({}));
      }
      return z.intersection(
        getSimpleType(params.unionTypes[0]),
        getSimpleType(params.unionTypes[1]),
      );
    case 'tuple': {
      if (!params.tupleTypes || params.tupleTypes.length === 0) {
        return z.tuple([]);
      }
      const types = params.tupleTypes.map((t) => getSimpleType(t));
      return z.tuple(types as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
    }
    case 'promise': {
      const promiseType = params.elementType || 'any';
      return z.promise(getSimpleType(promiseType));
    }
    case 'symbol':
      return z.symbol();
    default:
      return z.any();
  }
};

const getSimpleType = (typeName: string): z.ZodTypeAny => {
  switch (typeName) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'date':
      return z.date();
    case 'bigint':
      return z.bigint();
    case 'null':
      return z.null();
    case 'undefined':
      return z.undefined();
    case 'any':
      return z.any();
    case 'unknown':
      return z.unknown();
    default:
      return z.any();
  }
};

const buildDiscriminatedUnion = (
  config: NonNullable<SchemaField['params']['discriminatedUnion']>,
): z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]> => {
  const { discriminator, cases } = config;
  const caseSchemas: z.ZodDiscriminatedUnionOption<string>[] = [];

  for (const [_key, caseConfig] of Object.entries(cases)) {
    const shape: z.ZodRawShape = {
      [discriminator]: z.literal(caseConfig.value),
    };

    for (const field of caseConfig.fields) {
      shape[field.name] = buildFieldSchema(field);
    }

    caseSchemas.push(z.object(shape));
  }

  return z.discriminatedUnion(
    discriminator,
    caseSchemas as [
      z.ZodDiscriminatedUnionOption<string>,
      ...z.ZodDiscriminatedUnionOption<string>[],
    ],
  );
};

const applyValidations = (
  schema: z.ZodTypeAny,
  validations: ValidationRule[],
  field: SchemaField,
): z.ZodTypeAny => {
  let result = schema;

  for (const validation of validations) {
    switch (validation.type) {
      case 'min':
        if ('min' in result && typeof result.min === 'function') {
          result = (
            result as z.ZodString | z.ZodNumber | z.ZodArray<z.ZodTypeAny>
          ).min(
            Number(validation.value),
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'max':
        if ('max' in result && typeof result.max === 'function') {
          result = (
            result as z.ZodString | z.ZodNumber | z.ZodArray<z.ZodTypeAny>
          ).max(
            Number(validation.value),
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'length':
        if ('length' in result && typeof result.length === 'function') {
          result = (result as z.ZodString | z.ZodArray<z.ZodTypeAny>).length(
            Number(validation.value),
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'email':
        if (result instanceof z.ZodString) {
          result = result.email(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'url':
        if (result instanceof z.ZodString) {
          result = result.url(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'uuid':
        if (result instanceof z.ZodString) {
          result = result.uuid(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'cuid':
        if (result instanceof z.ZodString) {
          result = result.cuid(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'cuid2':
        if (result instanceof z.ZodString) {
          result = result.cuid2(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'ulid':
        if (result instanceof z.ZodString) {
          result = result.ulid(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'regex':
        if (result instanceof z.ZodString) {
          result = result.regex(
            new RegExp(validation.value),
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'startsWith':
        if (result instanceof z.ZodString) {
          result = result.startsWith(
            validation.value,
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'endsWith':
        if (result instanceof z.ZodString) {
          result = result.endsWith(
            validation.value,
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'datetime':
        if (result instanceof z.ZodString) {
          const datetimeOptions: {
            offset?: boolean;
            precision?: number;
            message?: string;
          } = {};
          if (field.params.stringOptions?.datetime) {
            const { offset, precision } = field.params.stringOptions.datetime;
            if (offset !== undefined) datetimeOptions.offset = offset;
            if (precision !== undefined) datetimeOptions.precision = precision;
          }
          if (validation.message) datetimeOptions.message = validation.message;
          result = result.datetime(
            Object.keys(datetimeOptions).length > 0
              ? datetimeOptions
              : undefined,
          );
        }
        break;
      case 'ip':
        if (result instanceof z.ZodString) {
          const ipOptions: { version?: 'v4' | 'v6'; message?: string } = {};
          if (field.params.stringOptions?.ip?.version) {
            ipOptions.version = field.params.stringOptions.ip.version;
          }
          if (validation.message) ipOptions.message = validation.message;
          result = result.ip(
            Object.keys(ipOptions).length > 0 ? ipOptions : undefined,
          );
        }
        break;
      case 'trim':
        if (result instanceof z.ZodString) {
          result = result.trim();
        }
        break;
      case 'toLowerCase':
        if (result instanceof z.ZodString) {
          result = result.toLowerCase();
        }
        break;
      case 'toUpperCase':
        if (result instanceof z.ZodString) {
          result = result.toUpperCase();
        }
        break;
      case 'int':
        if (result instanceof z.ZodNumber) {
          result = result.int(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'positive':
        if (result instanceof z.ZodNumber) {
          result = result.positive(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'negative':
        if (result instanceof z.ZodNumber) {
          result = result.negative(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'multipleOf':
        if (result instanceof z.ZodNumber) {
          result = result.multipleOf(
            Number(validation.value),
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'finite':
        if (result instanceof z.ZodNumber) {
          result = result.finite(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'safe':
        if (result instanceof z.ZodNumber) {
          result = result.safe(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'nonempty':
        if (
          'nonempty' in result &&
          typeof (result as z.ZodString | z.ZodArray<z.ZodTypeAny>).nonempty ===
            'function'
        ) {
          result = (result as z.ZodString | z.ZodArray<z.ZodTypeAny>).nonempty(
            validation.message ? { message: validation.message } : undefined,
          );
        }
        break;
      case 'optional':
        result = result.optional();
        break;
      case 'nullable':
        result = result.nullable();
        break;
      case 'nullish':
        result = result.nullish();
        break;
      case 'default':
        if (validation.value) {
          const defaultValue =
            field.type === 'number'
              ? Number(validation.value)
              : validation.value;
          result = result.default(defaultValue);
        }
        break;
      case 'readonly':
        result = result.readonly();
        break;
      case 'catch':
        if (validation.value) {
          const catchValue =
            field.type === 'number'
              ? Number(validation.value)
              : validation.value;
          result = result.catch(catchValue);
        }
        break;
    }
  }

  if (field.params.description) {
    result = result.describe(field.params.description);
  }

  return result;
};
