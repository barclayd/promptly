import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import type { SchemaField } from '~/lib/schema-types';

interface DiscriminatedUnionProps {
  field: SchemaField;
  onChange: (params: Partial<SchemaField['params']>) => void;
}

export const DiscriminatedUnion = ({
  field,
  onChange,
}: DiscriminatedUnionProps) => {
  const config = field.params.discriminatedUnion || {
    discriminator: '',
    cases: {},
  };

  const addCase = () => {
    const caseKey = `case${Object.keys(config.cases).length + 1}`;
    onChange({
      discriminatedUnion: {
        ...config,
        cases: {
          ...config.cases,
          [caseKey]: {
            value: '',
            fields: [],
          },
        },
      },
    });
  };

  const removeCase = (caseKey: string) => {
    const newCases = { ...config.cases };
    delete newCases[caseKey];
    onChange({
      discriminatedUnion: {
        ...config,
        cases: newCases,
      },
    });
  };

  const updateCaseValue = (caseKey: string, value: string) => {
    onChange({
      discriminatedUnion: {
        ...config,
        cases: {
          ...config.cases,
          [caseKey]: {
            ...config.cases[caseKey],
            value,
          },
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Discriminator Field</Label>
        <Input
          value={config.discriminator}
          onChange={(e) =>
            onChange({
              discriminatedUnion: {
                ...config,
                discriminator: e.target.value,
              },
            })
          }
          placeholder="type"
        />
      </div>

      <div className="space-y-2">
        <Label>Cases</Label>
        {Object.entries(config.cases).map(([caseKey, caseConfig]) => (
          <div
            key={caseKey}
            className="flex gap-2 items-start p-3 border rounded-md"
          >
            <div className="flex-1 space-y-2">
              <Input
                value={caseConfig.value}
                onChange={(e) => updateCaseValue(caseKey, e.target.value)}
                placeholder="Discriminator value"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeCase(caseKey)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addCase}>
          <Plus className="h-4 w-4 mr-1" />
          Add Case
        </Button>
      </div>
    </div>
  );
};
