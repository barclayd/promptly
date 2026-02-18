import { IconKey, IconSparkles } from '@tabler/icons-react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import type { SchemaField } from '~/lib/schema-types';
import { NotifyAdminButton } from './notify-admin-button';
import { FieldBuilder } from './schema-builder/field-builder';

interface SchemaBuilderProps {
  fields: SchemaField[];
  onChange?: (fields: SchemaField[]) => void;
  onGenerateTestData?: () => void;
  isGeneratingTestData?: boolean;
  hasApiKeys?: boolean;
  disabled?: boolean;
}

export const SchemaBuilder = ({
  fields,
  onChange,
  onGenerateTestData,
  isGeneratingTestData,
  hasApiKeys = true,
  disabled = false,
}: SchemaBuilderProps) => {
  const navigate = useNavigate();
  const { canManageBilling } = useCanManageBilling();
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

      {onGenerateTestData && !hasApiKeys && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
              <IconKey className="size-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground/80">
                API key required
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Connect an API key to generate test data from your schema.
              </p>
            </div>
          </div>
          <div className="mt-2.5">
            {canManageBilling ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  navigate('/settings?tab=llm-api-keys&open=create')
                }
              >
                <IconKey className="size-3.5" />
                Add API Key
              </Button>
            ) : (
              <NotifyAdminButton variant="compact" context="no-api-keys" />
            )}
          </div>
        </div>
      )}

      {onGenerateTestData && hasApiKeys && (
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
