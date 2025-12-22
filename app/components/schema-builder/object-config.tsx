import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import type { SchemaField } from '~/lib/schema-types';

interface ObjectConfigProps {
  field: SchemaField;
  onChange: (params: Partial<SchemaField['params']>) => void;
}

export const ObjectConfig = ({ field, onChange }: ObjectConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="isStrict">Strict Mode</Label>
        <Switch
          id="isStrict"
          checked={field.params.isStrict || false}
          onCheckedChange={(checked) => onChange({ isStrict: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="isPassthrough">Passthrough</Label>
        <Switch
          id="isPassthrough"
          checked={field.params.isPassthrough || false}
          onCheckedChange={(checked) => onChange({ isPassthrough: checked })}
        />
      </div>
    </div>
  );
};
