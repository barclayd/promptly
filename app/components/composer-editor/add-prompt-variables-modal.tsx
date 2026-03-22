'use client';

import {
  IconAlertTriangle,
  IconFileText,
  IconVariable,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { SchemaField } from '~/lib/schema-types';
import { cn } from '~/lib/utils';

type VariableCategory = 'new' | 'exists' | 'conflict';

type CategorizedVariable = {
  field: SchemaField;
  category: VariableCategory;
  existingType?: string;
};

type AddPromptVariablesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName: string;
  variables: SchemaField[];
  existingFields: SchemaField[];
  onAddSelected: (fields: SchemaField[]) => void;
};

const categorizeVariable = (
  field: SchemaField,
  existingFields: SchemaField[],
): CategorizedVariable => {
  const existing = existingFields.find((e) => e.name === field.name);

  if (!existing) {
    return { field, category: 'new' };
  }

  if (existing.type === field.type) {
    return { field, category: 'exists' };
  }

  return { field, category: 'conflict', existingType: existing.type };
};

export const AddPromptVariablesModal = ({
  open,
  onOpenChange,
  promptName,
  variables,
  existingFields,
  onAddSelected,
}: AddPromptVariablesModalProps) => {
  const categorized = useMemo(
    () => variables.map((v) => categorizeVariable(v, existingFields)),
    [variables, existingFields],
  );

  const newVariableIds = useMemo(
    () =>
      new Set(
        categorized.filter((c) => c.category === 'new').map((c) => c.field.id),
      ),
    [categorized],
  );

  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(newVariableIds),
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setCheckedIds(new Set(newVariableIds));
      }
      onOpenChange(next);
    },
    [onOpenChange, newVariableIds],
  );

  const handleToggle = useCallback((fieldId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(fieldId);
      } else {
        next.delete(fieldId);
      }
      return next;
    });
  }, []);

  const selectedFields = useMemo(
    () => variables.filter((v) => checkedIds.has(v.id)),
    [variables, checkedIds],
  );

  const handleAdd = useCallback(() => {
    onAddSelected(selectedFields);
    onOpenChange(false);
  }, [onAddSelected, selectedFields, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFileText className="size-5 text-blue-500" />
            <span>
              Import variables from{' '}
              <span className="text-primary">{promptName}</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            Select which variables to add to your composer's schema.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1">
          {categorized.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              This prompt has no variables.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {categorized.map(({ field, category, existingType }) => (
                <div
                  key={field.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1.5',
                    category === 'exists' && 'opacity-50',
                  )}
                >
                  {category === 'conflict' ? (
                    <IconAlertTriangle className="size-4 shrink-0 text-amber-500" />
                  ) : (
                    <Checkbox
                      checked={
                        category === 'exists' || checkedIds.has(field.id)
                      }
                      disabled={category === 'exists'}
                      onCheckedChange={(checked) =>
                        handleToggle(field.id, checked === true)
                      }
                    />
                  )}

                  <IconVariable className="size-3.5 shrink-0 text-muted-foreground" />

                  <span className="text-sm font-medium truncate">
                    {field.name}
                  </span>

                  <Badge variant="outline" className="text-xs ml-auto shrink-0">
                    {field.type}
                  </Badge>

                  {category === 'exists' && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      Already in schema
                    </span>
                  )}

                  {category === 'conflict' && (
                    <span className="text-amber-500 text-xs shrink-0">
                      Exists as {existingType}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleAdd} disabled={selectedFields.length === 0}>
            Add Selected ({selectedFields.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
