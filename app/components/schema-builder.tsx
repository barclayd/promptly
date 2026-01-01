import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { SchemaField } from '~/lib/schema-types';
import { FieldBuilder } from './schema-builder/field-builder';

interface SchemaBuilderProps {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}

export const SchemaBuilder = ({ fields, onChange }: SchemaBuilderProps) => {
  const addField = () => {
    const newField: SchemaField = {
      id: crypto.randomUUID(),
      name: '',
      type: 'string',
      validations: [],
      params: {},
    };
    onChange([...fields, newField]);
  };

  const updateField = (id: string, updatedField: SchemaField) => {
    onChange(fields.map((field) => (field.id === id ? updatedField : field)));
  };

  const deleteField = (id: string) => {
    onChange(fields.filter((field) => field.id !== id));
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldBuilder
          key={field.id}
          field={field}
          onChange={(updatedField) => updateField(field.id, updatedField)}
          onDelete={() => deleteField(field.id)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addField}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Field
      </Button>
    </div>
  );
};
