'use client';

import { IconShieldCheck, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
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
          <DialogTitle className="flex items-center gap-2">
            <IconTrash className="size-5 text-destructive" />
            Clean up variables
          </DialogTitle>
          <DialogDescription>
            The following variables were used by{' '}
            <span className="font-semibold text-foreground">{promptName}</span>.
            Select which to remove from your schema.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1">
          <div className="flex flex-col gap-1">
            {variables.map((variable) => {
              const isProtected = !variable.orphaned;
              const protection = getProtectionReason(variable);
              const isChecked = checkedIds.has(variable.field.id);

              return (
                <label
                  key={variable.field.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 transition-colors',
                    isProtected
                      ? 'cursor-not-allowed'
                      : 'cursor-pointer hover:bg-accent',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleToggle(variable.field.id, checked === true)
                    }
                    disabled={isProtected}
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium truncate',
                      isProtected && 'opacity-50',
                    )}
                  >
                    {variable.field.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(isProtected && 'opacity-50')}
                  >
                    {variable.field.type}
                  </Badge>
                  {protection && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <IconShieldCheck className="size-3.5" />
                      {protection.text}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep All
          </Button>
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
