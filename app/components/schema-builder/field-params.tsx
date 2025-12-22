import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import type { SchemaField } from '~/lib/schema-types';
import { ArrayConfig } from './array-config';
import { DiscriminatedUnion } from './discriminated-union';
import { EnumValues } from './enum-values';
import { FunctionSchema } from './function-schema';
import { ObjectConfig } from './object-config';
import { StringValidations } from './string-validations';

interface FieldParamsProps {
  field: SchemaField;
  onChange: (params: Partial<SchemaField['params']>) => void;
}

export const FieldParams = ({ field, onChange }: FieldParamsProps) => {
  const showEnumValues = ['enum', 'nativeEnum', 'literal'].includes(field.type);
  const showArrayConfig = field.type === 'array';
  const showObjectConfig = field.type === 'object';
  const showFunctionConfig = field.type === 'function';
  const showDiscriminatedUnion =
    field.type === 'union' && field.params.isDiscriminatedUnion;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={field.params.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Field description"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="coerce">Coerce Type</Label>
        <Switch
          id="coerce"
          checked={field.params.coerce || false}
          onCheckedChange={(checked) => onChange({ coerce: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invalid_type_error">Invalid Type Error</Label>
        <Input
          id="invalid_type_error"
          value={field.params.invalid_type_error || ''}
          onChange={(e) => onChange({ invalid_type_error: e.target.value })}
          placeholder="Custom error message"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="required_error">Required Error</Label>
        <Input
          id="required_error"
          value={field.params.required_error || ''}
          onChange={(e) => onChange({ required_error: e.target.value })}
          placeholder="Custom required error message"
        />
      </div>

      {showEnumValues && (
        <EnumValues
          values={field.params.enumValues || ['']}
          onChange={(values) => onChange({ enumValues: values })}
        />
      )}

      {showArrayConfig && <ArrayConfig field={field} onChange={onChange} />}

      {showObjectConfig && <ObjectConfig field={field} onChange={onChange} />}

      {showFunctionConfig && <FunctionSchema field={field} onChange={onChange} />}

      {field.type === 'union' && !field.params.isDiscriminatedUnion && (
        <div className="flex items-center justify-between">
          <Label htmlFor="isDiscriminatedUnion">Discriminated Union</Label>
          <Switch
            id="isDiscriminatedUnion"
            checked={false}
            onCheckedChange={(checked) =>
              onChange({
                isDiscriminatedUnion: checked,
                discriminatedUnion: checked
                  ? { discriminator: 'type', cases: {} }
                  : undefined,
              })
            }
          />
        </div>
      )}

      {showDiscriminatedUnion && (
        <DiscriminatedUnion field={field} onChange={onChange} />
      )}

      {field.type === 'string' && <StringValidations field={field} onChange={onChange} />}
    </div>
  );
};
