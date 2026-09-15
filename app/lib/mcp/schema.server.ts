import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import type { z } from 'zod';

type JsonSchemaConverter = NonNullable<
  StandardSchemaWithJSON['~standard']['jsonSchema']
>;

const conversions = new WeakMap<z.ZodType, JsonSchemaConverter>();

export const cachedMcpJsonSchema = (schema: z.ZodType): JsonSchemaConverter => {
  const existing = conversions.get(schema);
  if (existing) return existing;
  const source = schema['~standard'].jsonSchema;
  const cache = (convert: JsonSchemaConverter['input']) => {
    let result: Record<string, unknown> | undefined;
    return (options: Parameters<typeof convert>[0]) => {
      if (
        options.target !== 'draft-2020-12' ||
        options.libraryOptions !== undefined
      )
        return convert(options);
      result ??= convert(options);
      return result;
    };
  };
  const converter = {
    input: cache(source.input),
    output: cache(source.output),
  };
  conversions.set(schema, converter);
  return converter;
};

export const cachedMcpSchema = <Input, Output>(
  schema: z.ZodType<Output, Input>,
): StandardSchemaWithJSON<Input, Output> => ({
  '~standard': {
    ...schema['~standard'],
    jsonSchema: cachedMcpJsonSchema(schema),
  },
});
