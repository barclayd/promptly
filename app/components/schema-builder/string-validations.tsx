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
import type { SchemaField } from '~/lib/schema-types';

interface StringValidationsProps {
  field: SchemaField;
  onChange: (params: Partial<SchemaField['params']>) => void;
}

export const StringValidations = ({ field, onChange }: StringValidationsProps) => {
  const hasDatetimeValidation = field.validations.some((v) => v.type === 'datetime');
  const hasIpValidation = field.validations.some((v) => v.type === 'ip');

  return (
    <div className="space-y-4">
      {hasDatetimeValidation && (
        <div className="space-y-2">
          <Label>DateTime Options</Label>
          <div className="flex items-center justify-between">
            <Label htmlFor="datetime-offset">Include Offset</Label>
            <Switch
              id="datetime-offset"
              checked={field.params.stringOptions?.datetime?.offset || false}
              onCheckedChange={(checked) =>
                onChange({
                  stringOptions: {
                    ...field.params.stringOptions,
                    datetime: {
                      ...field.params.stringOptions?.datetime,
                      offset: checked,
                    },
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="datetime-precision">Precision</Label>
            <Input
              id="datetime-precision"
              type="number"
              min="0"
              max="3"
              value={field.params.stringOptions?.datetime?.precision || 0}
              onChange={(e) =>
                onChange({
                  stringOptions: {
                    ...field.params.stringOptions,
                    datetime: {
                      ...field.params.stringOptions?.datetime,
                      precision: parseInt(e.target.value) || 0,
                    },
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {hasIpValidation && (
        <div className="space-y-2">
          <Label>IP Version</Label>
          <Select
            value={field.params.stringOptions?.ip?.version || 'v4'}
            onValueChange={(value: 'v4' | 'v6') =>
              onChange({
                stringOptions: {
                  ...field.params.stringOptions,
                  ip: { version: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v4">IPv4</SelectItem>
              <SelectItem value="v6">IPv6</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
