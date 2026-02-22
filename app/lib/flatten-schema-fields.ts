import type { SchemaField } from './schema-types';

export type FlatVariable = { id: string; path: string };

export const flattenSchemaFields = (
  fields: SchemaField[],
  prefix = '',
): FlatVariable[] => {
  const result: FlatVariable[] = [];

  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    result.push({ id: field.id, path });
  }

  return result;
};
