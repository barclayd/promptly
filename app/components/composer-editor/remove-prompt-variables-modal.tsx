'use client';

import { IconShieldCheck, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
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

export type VariableStatus = {
  field: SchemaField;
  orphaned: boolean;
  usedByPrompts: string[];
  usedInContent: boolean;
};

export type RemovePromptVariablesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName: string;
  variables: VariableStatus[];
  onRemoveSelected: (fieldIds: string[]) => void;
};

const getOrphanedIds = (variables: VariableStatus[]): Set<string> =>
  new Set(variables.filter((v) => v.orphaned).map((v) => v.field.id));

const getProtectionReason = (
  variable: VariableStatus,
): { text: string } | null => {
  if (variable.usedInContent) {
    return { text: 'Referenced in content' };
  }
  if (variable.usedByPrompts.length > 0) {
    return { text: `Used by ${variable.usedByPrompts.join(', ')}` };
  }
  return null;
};

export const RemovePromptVariablesModal = ({
  open,
  onOpenChange,
  promptName,
  variables,
  onRemoveSelected,
}: RemovePromptVariablesModalProps) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() =>
    getOrphanedIds(variables),
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setCheckedIds(getOrphanedIds(variables));
      }
      onOpenChange(next);
    },
    [onOpenChange, variables],
  );

  const selectedCount = checkedIds.size;

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

  const handleRemoveSelected = useCallback(() => {
    onRemoveSelected(Array.from(checkedIds));
  }, [checkedIds, onRemoveSelected]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-normal">
            <div className="flex size-8 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/15 shrink-0">
              <IconTrash className="size-4 text-destructive" />
            </div>
            Clean up variables
          </DialogTitle>
          <DialogDescription>
            The following variables were used by{' '}
            <span className="font-semibold text-foreground">{promptName}</span>.
            Select which to remove from your schema.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 max-h-72 overflow-y-auto">
          <FieldGroup>
            {variables.map((variable) => {
              const isProtected = !variable.orphaned;
              const protection = getProtectionReason(variable);
              const isChecked = checkedIds.has(variable.field.id);

              return (
                <Field key={variable.field.id} orientation="horizontal">
                  <label
                    className={cn(
                      'flex w-full items-start gap-3',
                      isProtected ? 'cursor-not-allowed' : 'cursor-pointer',
                    )}
                  >
                    <div className="pt-0.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleToggle(variable.field.id, checked === true)
                        }
                        disabled={isProtected}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium truncate',
                            isProtected && 'opacity-50',
                          )}
                        >
                          {variable.field.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs ml-auto shrink-0',
                            isProtected && 'opacity-50',
                          )}
                        >
                          {variable.field.type}
                        </Badge>
                      </div>
                      {protection && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconShieldCheck className="size-3.5 shrink-0" />
                          {protection.text}
                        </p>
                      )}
                    </div>
                  </label>
                </Field>
              );
            })}
          </FieldGroup>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep All</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={selectedCount === 0}
            onClick={handleRemoveSelected}
          >
            Remove Selected ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
