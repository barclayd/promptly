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
import { Switch } from '~/components/ui/switch';
import type { FunctionParameter, SchemaField } from '~/lib/schema-types';

interface FunctionSchemaProps {
  field: SchemaField;
  onChange: (params: Partial<SchemaField['params']>) => void;
}

const zodTypes = [
  'string',
  'number',
  'boolean',
  'date',
  'bigint',
  'any',
  'unknown',
  'void',
  'object',
];

export const FunctionSchema = ({ field, onChange }: FunctionSchemaProps) => {
  const params = field.params.functionParams || [];

  const addParameter = () => {
    onChange({
      functionParams: [
        ...params,
        { name: '', type: 'string', optional: false },
      ],
    });
  };

  const removeParameter = (index: number) => {
    const newParams = params.filter((_, i) => i !== index);
    onChange({ functionParams: newParams });
  };

  const updateParameter = (
    index: number,
    updates: Partial<FunctionParameter>,
  ) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], ...updates };
    onChange({ functionParams: newParams });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Return Type</Label>
        <Select
          value={field.params.returnType || 'void'}
          onValueChange={(value) => onChange({ returnType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zodTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="isAsync">Async Function</Label>
        <Switch
          id="isAsync"
          checked={field.params.isAsync || false}
          onCheckedChange={(checked) => onChange({ isAsync: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>Parameters</Label>
        {params.map((param, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Parameter order is significant
          <div key={index} className="space-y-2 p-3 border rounded-md">
            <div className="flex gap-2">
              <Input
                placeholder="Parameter name"
                value={param.name}
                onChange={(e) =>
                  updateParameter(index, { name: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeParameter(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={param.type}
              onValueChange={(value) => updateParameter(index, { type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zodTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              <Label>Optional</Label>
              <Switch
                checked={param.optional || false}
                onCheckedChange={(checked) =>
                  updateParameter(index, { optional: checked })
                }
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addParameter}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Parameter
        </Button>
      </div>
    </div>
  );
};
