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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Field, FieldGroup } from '~/components/ui/field';
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
          <DialogTitle className="flex items-center gap-2 text-base font-normal">
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/10 dark:bg-blue-500/15 shrink-0">
              <IconFileText className="size-4 text-blue-500" />
            </div>
            <span>
              Import variables from{' '}
              <span className="text-primary">{promptName}</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            Select which variables to add to your composer&apos;s schema.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 max-h-72 overflow-y-auto">
          {categorized.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              This prompt has no variables.
            </p>
          ) : (
            <FieldGroup>
              {categorized.map(({ field, category, existingType }) => (
                <Field key={field.id} orientation="horizontal">
                  <label
                    className={cn(
                      'flex w-full items-start gap-3 cursor-pointer',
                      category === 'exists' && 'opacity-50 cursor-default',
                      category === 'conflict' && 'cursor-default',
                    )}
                  >
                    <div className="pt-0.5">
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
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <IconVariable className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">
                          {field.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs ml-auto shrink-0"
                        >
                          {field.type}
                        </Badge>
                      </div>
                      {category === 'exists' && (
                        <p className="text-muted-foreground text-xs">
                          Already in schema
                        </p>
                      )}
                      {category === 'conflict' && (
                        <p className="text-amber-500 text-xs">
                          Exists as {existingType}
                        </p>
                      )}
                    </div>
                  </label>
                </Field>
              ))}
            </FieldGroup>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Skip</Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={selectedFields.length === 0}>
            Add Selected ({selectedFields.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
