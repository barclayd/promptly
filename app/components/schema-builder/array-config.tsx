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

interface ArrayConfigProps {
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
  'object',
];

export const ArrayConfig = ({ field, onChange }: ArrayConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="isTuple">Is Tuple</Label>
        <Switch
          id="isTuple"
          checked={field.params.isTuple || false}
          onCheckedChange={(checked) =>
            onChange({
              isTuple: checked,
              tupleTypes: checked ? ['string'] : undefined,
            })
          }
        />
      </div>

      {field.params.isTuple ? (
        <div className="space-y-2">
          <Label>Tuple Types</Label>
          {(field.params.tupleTypes || ['string']).map((type, index) => (
            <Select
              // biome-ignore lint/suspicious/noArrayIndexKey: Tuple types are ordered by position
              key={index}
              value={type}
              onValueChange={(value) => {
                const newTypes = [...(field.params.tupleTypes || [])];
                newTypes[index] = value;
                onChange({ tupleTypes: newTypes });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zodTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Element Type</Label>
          <Select
            value={field.params.elementType || 'any'}
            onValueChange={(value) => onChange({ elementType: value })}
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
      )}
    </div>
  );
};
