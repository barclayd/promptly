import { Trash2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
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
import type { SchemaField } from '~/lib/schema-types';
import { FieldParams } from './field-params';
import { ValidationBuilder } from './validation-builder';

interface FieldBuilderProps {
  field: SchemaField;
  onChange: (field: SchemaField) => void;
  onDelete: () => void;
  disabled?: boolean;
}

const zodTypes = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'bigint', label: 'BigInt' },
  { value: 'null', label: 'Null' },
  { value: 'undefined', label: 'Undefined' },
  { value: 'void', label: 'Void' },
  { value: 'any', label: 'Any' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'never', label: 'Never' },
  { value: 'nan', label: 'NaN' },
  { value: 'literal', label: 'Literal' },
  { value: 'enum', label: 'Enum' },
  { value: 'nativeEnum', label: 'Native Enum' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
  { value: 'record', label: 'Record' },
  { value: 'map', label: 'Map' },
  { value: 'set', label: 'Set' },
  { value: 'union', label: 'Union' },
  { value: 'intersection', label: 'Intersection' },
  { value: 'tuple', label: 'Tuple' },
  { value: 'promise', label: 'Promise' },
  { value: 'function', label: 'Function' },
  { value: 'lazy', label: 'Lazy' },
  { value: 'custom', label: 'Custom' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'instanceof', label: 'InstanceOf' },
  { value: 'symbol', label: 'Symbol' },
];

export const FieldBuilder = ({
  field,
  onChange,
  onDelete,
  disabled = false,
}: FieldBuilderProps) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${field.id}`}>Field Name</Label>
            <Input
              id={`name-${field.id}`}
              value={field.name}
              onChange={(e) => onChange({ ...field, name: e.target.value })}
              placeholder="Field name"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`type-${field.id}`}>Type</Label>
            <Select
              value={field.type}
              onValueChange={(value) => onChange({ ...field, type: value })}
              disabled={disabled}
            >
              <SelectTrigger id={`type-${field.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zodTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="mt-8"
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full" disabled={disabled}>
        <AccordionItem value="params">
          <AccordionTrigger disabled={disabled}>Parameters</AccordionTrigger>
          <AccordionContent>
            <FieldParams
              field={field}
              onChange={(params) =>
                onChange({ ...field, params: { ...field.params, ...params } })
              }
              disabled={disabled}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="validations">
          <AccordionTrigger disabled={disabled}>Validations</AccordionTrigger>
          <AccordionContent>
            <ValidationBuilder
              field={field}
              onChange={(validations) => onChange({ ...field, validations })}
              disabled={disabled}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
