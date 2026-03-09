'use client';

import { IconCode } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { flattenSchemaFields } from '~/lib/flatten-schema-fields';
import { cn } from '~/lib/utils';
import { useComposerEditorStore } from '~/stores/composer-editor-store';

type VariableRefPickerProps = {
  editor: Editor;
  collapsed?: boolean;
  variant?: 'ghost' | 'secondary' | 'outline';
};

export const VariableRefPicker = ({
  editor,
  collapsed,
  variant = 'ghost',
}: VariableRefPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const schemaFields = useComposerEditorStore((s) => s.schemaFields);
  const variables = useMemo(
    () => flattenSchemaFields(schemaFields),
    [schemaFields],
  );

  const filteredVariables = useMemo(() => {
    if (!search) return variables;
    const lower = search.toLowerCase();
    return variables.filter((v) => v.path.toLowerCase().includes(lower));
  }, [variables, search]);

  const handleSelect = useCallback(
    (fieldId: string, fieldPath: string) => {
      editor.chain().focus().insertVariableRef({ fieldId, fieldPath }).run();
      setOpen(false);
      setSearch('');
    },
    [editor],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant={variant}
              className={cn(
                'h-7 rounded-sm focus-visible:ring-0',
                collapsed ? 'w-7 px-0' : 'gap-1 px-2 text-xs font-medium',
              )}
              type="button"
            >
              <IconCode className="size-3.5" />
              {!collapsed && <span>Add variable</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Add variable reference
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search variables..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {variables.length === 0
                ? 'No variables defined. Add fields in Schema Builder.'
                : 'No matching variables'}
            </CommandEmpty>
            <CommandGroup>
              {filteredVariables.map((variable) => (
                <CommandItem
                  key={variable.id}
                  value={variable.id}
                  onSelect={() => handleSelect(variable.id, variable.path)}
                  className="gap-2 text-sm cursor-pointer"
                >
                  <IconCode className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{variable.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
