import type { SchemaField, ValidationRule } from './schema-types';

export const generateZodSchema = (fields: SchemaField[]): string => {
  if (fields.length === 0) {
    return "import { z } from 'zod';\n\nconst schema = z.object({});\n\nexport default schema;";
  }

  const imports = new Set(['z']);
  const schemaFields: string[] = [];

  fields.forEach((field) => {
    const fieldSchema = generateFieldSchema(field, imports);
    schemaFields.push(`  ${field.name}: ${fieldSchema}`);
  });

  const importStatement = `import { ${Array.from(imports).join(', ')} } from 'zod';`;
  const schemaDefinition = `const schema = z.object({\n${schemaFields.join(',\n')}\n});`;

  return `${importStatement}\n\n${schemaDefinition}\n\nexport default schema;`;
};

const generateFieldSchema = (
  field: SchemaField,
  imports: Set<string>,
): string => {
  let schema = generateBaseType(field, imports);
  schema = applyValidations(schema, field.validations, field);
  return schema;
};

const generateBaseType = (field: SchemaField, imports: Set<string>): string => {
  const { type, params } = field;

  switch (type) {
    case 'string':
      return params.coerce ? 'z.coerce.string()' : 'z.string()';
    case 'number':
      return params.coerce ? 'z.coerce.number()' : 'z.number()';
    case 'boolean':
      return params.coerce ? 'z.coerce.boolean()' : 'z.boolean()';
    case 'date':
      return params.coerce ? 'z.coerce.date()' : 'z.date()';
    case 'bigint':
      return params.coerce ? 'z.coerce.bigint()' : 'z.bigint()';
    case 'null':
      return 'z.null()';
    case 'undefined':
      return 'z.undefined()';
    case 'void':
      return 'z.void()';
    case 'any':
      return 'z.any()';
    case 'unknown':
      return 'z.unknown()';
    case 'never':
      return 'z.never()';
    case 'nan':
      return 'z.nan()';
    case 'literal':
      return `z.literal(${params.enumValues?.[0] || '""'})`;
    case 'enum': {
      if (!params.enumValues || params.enumValues.length === 0) {
        return 'z.enum([""])';
      }
      const enumValues = params.enumValues.map((v) => `"${v}"`).join(', ');
      return `z.enum([${enumValues}])`;
    }
    case 'nativeEnum':
      return `z.nativeEnum(${params.enumValues?.[0] || 'EnumType'})`;
    case 'array': {
      if (params.isTuple && params.tupleTypes && params.tupleTypes.length > 0) {
        const tupleTypes = params.tupleTypes.map((t) => `z.${t}()`).join(', ');
        return `z.tuple([${tupleTypes}])`;
      }
      const elementType = params.elementType || 'any';
      return `z.array(z.${elementType}())`;
    }
    case 'object': {
      let objectSchema = 'z.object({})';
      if (params.isStrict) {
        objectSchema += '.strict()';
      }
      if (params.isPassthrough) {
        objectSchema += '.passthrough()';
      }
      return objectSchema;
    }
    case 'record': {
      const keyType = params.keyType || 'string';
      const valueType = params.valueType || 'any';
      return `z.record(z.${keyType}(), z.${valueType}())`;
    }
    case 'map': {
      const mapKeyType = params.keyType || 'string';
      const mapValueType = params.valueType || 'any';
      return `z.map(z.${mapKeyType}(), z.${mapValueType}())`;
    }
    case 'set': {
      const setValueType = params.elementType || 'any';
      return `z.set(z.${setValueType}())`;
    }
    case 'union': {
      if (params.isDiscriminatedUnion && params.discriminatedUnion) {
        return generateDiscriminatedUnion(params.discriminatedUnion, imports);
      }
      if (!params.unionTypes || params.unionTypes.length === 0) {
        return 'z.union([z.string(), z.number()])';
      }
      const unionTypes = params.unionTypes.map((t) => `z.${t}()`).join(', ');
      return `z.union([${unionTypes}])`;
    }
    case 'intersection':
      if (!params.unionTypes || params.unionTypes.length < 2) {
        return 'z.intersection(z.object({}), z.object({}))';
      }
      return `z.intersection(z.${params.unionTypes[0]}(), z.${params.unionTypes[1]}())`;
    case 'tuple': {
      if (!params.tupleTypes || params.tupleTypes.length === 0) {
        return 'z.tuple([])';
      }
      const types = params.tupleTypes.map((t) => `z.${t}()`).join(', ');
      return `z.tuple([${types}])`;
    }
    case 'promise': {
      const promiseType = params.elementType || 'any';
      return `z.promise(z.${promiseType}())`;
    }
    case 'function':
      return generateFunctionSchema(params);
    case 'lazy':
      return 'z.lazy(() => schema)';
    case 'custom':
      return 'z.custom()';
    case 'pipeline': {
      const pipelineTypes = params.unionTypes || ['string', 'string'];
      return `z.pipeline(z.${pipelineTypes[0]}(), z.${pipelineTypes[1]}())`;
    }
    case 'instanceof':
      return `z.instanceof(${params.enumValues?.[0] || 'Class'})`;
    case 'symbol':
      return 'z.symbol()';
    default:
      return 'z.any()';
  }
};

const generateDiscriminatedUnion = (
  config: NonNullable<SchemaField['params']['discriminatedUnion']>,
  imports: Set<string>,
): string => {
  const { discriminator, cases } = config;
  const caseSchemas: string[] = [];

  Object.entries(cases).forEach(([_key, caseConfig]) => {
    const fields = caseConfig.fields.map((field) => {
      const fieldSchema = generateFieldSchema(field, imports);
      return `${field.name}: ${fieldSchema}`;
    });
    const discriminatorField = `${discriminator}: z.literal("${caseConfig.value}")`;
    caseSchemas.push(
      `z.object({ ${discriminatorField}, ${fields.join(', ')} })`,
    );
  });

  return `z.discriminatedUnion("${discriminator}", [${caseSchemas.join(', ')}])`;
};

const generateFunctionSchema = (params: SchemaField['params']): string => {
  const functionParams = params.functionParams || [];
  const returnType = params.returnType || 'void';

  if (functionParams.length === 0) {
    return `z.function().returns(z.${returnType}())`;
  }

  const args = functionParams.map((param) => {
    const paramType = `z.${param.type}()`;
    return param.optional ? `${paramType}.optional()` : paramType;
  });

  const argsString = args.join(', ');
  return `z.function().args(${argsString}).returns(z.${returnType}())`;
};

const applyValidations = (
  schema: string,
  validations: ValidationRule[],
  field: SchemaField,
): string => {
  let result = schema;

  validations.forEach((validation) => {
    switch (validation.type) {
      case 'min':
        result += `.min(${validation.value}${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'max':
        result += `.max(${validation.value}${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'length':
        result += `.length(${validation.value}${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'email':
        result += `.email(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'url':
        result += `.url(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'uuid':
        result += `.uuid(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'cuid':
        result += `.cuid(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'cuid2':
        result += `.cuid2(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'ulid':
        result += `.ulid(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'regex':
        result += `.regex(/${validation.value}/${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'startsWith':
        result += `.startsWith("${validation.value}"${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'endsWith':
        result += `.endsWith("${validation.value}"${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'datetime':
        if (field.params.stringOptions?.datetime) {
          const { offset, precision } = field.params.stringOptions.datetime;
          const options: string[] = [];
          if (offset !== undefined) options.push(`offset: ${offset}`);
          if (precision !== undefined) options.push(`precision: ${precision}`);
          if (validation.message)
            options.push(`message: "${validation.message}"`);
          result += `.datetime(${options.length > 0 ? `{ ${options.join(', ')} }` : ''})`;
        } else {
          result += `.datetime(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        }
        break;
      case 'ip':
        if (field.params.stringOptions?.ip?.version) {
          result += `.ip({ version: "${field.params.stringOptions.ip.version}"${validation.message ? `, message: "${validation.message}"` : ''} })`;
        } else {
          result += `.ip(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        }
        break;
      case 'trim':
        result += '.trim()';
        break;
      case 'toLowerCase':
        result += '.toLowerCase()';
        break;
      case 'toUpperCase':
        result += '.toUpperCase()';
        break;
      case 'int':
        result += `.int(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'positive':
        result += `.positive(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'negative':
        result += `.negative(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'multipleOf':
        result += `.multipleOf(${validation.value}${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'finite':
        result += `.finite(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'safe':
        result += `.safe(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'nonempty':
        result += `.nonempty(${validation.message ? `{ message: "${validation.message}" }` : ''})`;
        break;
      case 'optional':
        result += '.optional()';
        break;
      case 'nullable':
        result += '.nullable()';
        break;
      case 'nullish':
        result += '.nullish()';
        break;
      case 'default':
        if (validation.value) {
          const defaultValue =
            field.type === 'string'
              ? `"${validation.value}"`
              : validation.value;
          result += `.default(${defaultValue})`;
        }
        break;
      case 'transform':
        if (validation.transform) {
          result += `.transform((val) => ${validation.transform})`;
        }
        break;
      case 'refine':
        result += `.refine((val) => ${validation.value}${validation.message ? `, { message: "${validation.message}" }` : ''})`;
        break;
      case 'superRefine':
        result += `.superRefine((val, ctx) => { ${validation.value} })`;
        break;
      case 'brand':
        result += `.brand("${validation.value}")`;
        break;
      case 'readonly':
        result += '.readonly()';
        break;
      case 'catch':
        if (validation.value) {
          const catchValue =
            field.type === 'string'
              ? `"${validation.value}"`
              : validation.value;
          result += `.catch(${catchValue})`;
        }
        break;
    }
  });

  if (field.params.description) {
    result += `.describe("${field.params.description}")`;
  }

  return result;
};

export const formatCode = (code: string): string => {
  return code;
};
