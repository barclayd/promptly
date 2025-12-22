import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

interface EnumValuesProps {
  values: string[];
  onChange: (values: string[]) => void;
}

export const EnumValues = ({ values, onChange }: EnumValuesProps) => {
  const addValue = () => {
    onChange([...values, '']);
  };

  const removeValue = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const updateValue = (index: number, value: string) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  return (
    <div className="space-y-2">
      <Label>Enum Values</Label>
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => updateValue(index, e.target.value)}
            placeholder={`Value ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeValue(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addValue}>
        <Plus className="h-4 w-4 mr-1" />
        Add Value
      </Button>
    </div>
  );
};
