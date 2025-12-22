import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { SchemaField, ValidationRule } from '~/lib/schema-types';
import { getValidationOptions } from '~/lib/validation-options';

interface ValidationBuilderProps {
  field: SchemaField;
  onChange: (validations: ValidationRule[]) => void;
}

export const ValidationBuilder = ({
  field,
  onChange,
}: ValidationBuilderProps) => {
  const validationOptions = getValidationOptions(field.type);

  const addValidation = () => {
    const newValidation: ValidationRule = {
      id: crypto.randomUUID(),
      type: validationOptions[0]?.value || 'optional',
      message: '',
      value: '',
    };
    onChange([...field.validations, newValidation]);
  };

  const removeValidation = (id: string) => {
    onChange(field.validations.filter((v) => v.id !== id));
  };

  const updateValidation = (id: string, updates: Partial<ValidationRule>) => {
    onChange(
      field.validations.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  };

  const needsValue = (type: string): boolean => {
    return [
      'min',
      'max',
      'length',
      'regex',
      'startsWith',
      'endsWith',
      'multipleOf',
      'default',
      'transform',
      'refine',
      'size',
    ].includes(type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Validations</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addValidation}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Validation
        </Button>
      </div>

      {field.validations.map((validation) => (
        <div
          key={validation.id}
          className="space-y-2 p-3 border rounded-md bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <Select
              value={validation.type}
              onValueChange={(value) =>
                updateValidation(validation.id, { type: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeValidation(validation.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {needsValue(validation.type) && (
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={validation.value}
                onChange={(e) =>
                  updateValidation(validation.id, { value: e.target.value })
                }
                placeholder="Validation value"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Custom Error Message (Optional)</Label>
            <Input
              value={validation.message}
              onChange={(e) =>
                updateValidation(validation.id, { message: e.target.value })
              }
              placeholder="Error message"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
