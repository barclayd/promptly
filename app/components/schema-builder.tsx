import { IconSparkles } from '@tabler/icons-react';
import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { SchemaField } from '~/lib/schema-types';
import { FieldBuilder } from './schema-builder/field-builder';

interface SchemaBuilderProps {
  fields: SchemaField[];
  onChange?: (fields: SchemaField[]) => void;
  onGenerateTestData?: () => void;
  isGeneratingTestData?: boolean;
  disabled?: boolean;
}

export const SchemaBuilder = ({
  fields,
  onChange,
  onGenerateTestData,
  isGeneratingTestData,
  disabled = false,
}: SchemaBuilderProps) => {
  const addField = () => {
    if (!onChange) return;
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
    onChange?.(fields.map((field) => (field.id === id ? updatedField : field)));
  };

  const deleteField = (id: string) => {
    onChange?.(fields.filter((field) => field.id !== id));
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldBuilder
          key={field.id}
          field={field}
          onChange={(updatedField) => updateField(field.id, updatedField)}
          onDelete={() => deleteField(field.id)}
          disabled={disabled}
        />
      ))}

      <Button
        type="button"
        onClick={addField}
        className="w-full"
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Field
      </Button>

      {onGenerateTestData && (
        <Button
          type="button"
          variant="outline"
          onClick={onGenerateTestData}
          disabled={disabled || fields.length === 0 || isGeneratingTestData}
          className="w-full"
        >
          {isGeneratingTestData ? (
            <>
              <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <IconSparkles className="h-4 w-4 mr-2" />
              Generate test data
            </>
          )}
        </Button>
      )}
    </div>
  );
};
