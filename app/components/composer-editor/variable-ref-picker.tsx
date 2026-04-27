'use client';

import { IconCode } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  onInsertVariable?: (fieldId: string, fieldPath: string) => void;
  /** Render dropdown inline (no portal) — for use inside other popovers. */
  inline?: boolean;
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
};

const VariableCommandList = ({
  variables,
  filteredVariables,
  search,
  setSearch,
  onSelect,
  autoFocus,
}: {
  variables: Array<{ id: string; path: string }>;
  filteredVariables: Array<{ id: string; path: string }>;
  search: string;
  setSearch: (v: string) => void;
  onSelect: (fieldId: string, fieldPath: string) => void;
  autoFocus?: boolean;
}) => (
  <Command shouldFilter={false}>
    <CommandInput
      placeholder="Search variables..."
      value={search}
      onValueChange={setSearch}
      ref={autoFocus ? (el) => el?.focus() : undefined}
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
            onSelect={() => onSelect(variable.id, variable.path)}
            className="gap-2 text-sm cursor-pointer"
          >
            <IconCode className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{variable.path}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </Command>
);

export const VariableRefPicker = ({
  editor,
  collapsed,
  variant = 'ghost',
  onInsertVariable,
  inline,
  triggerLabel,
  triggerIcon,
}: VariableRefPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Keep a ref to always read the latest editor prop. The outer link
  // popover's DismissableLayer can cause remounts, which means the
  // editor captured in useCallback closures can become stale/destroyed.
  const editorRef = useRef(editor);
  editorRef.current = editor;

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
      if (inline) {
        // Inline mode: dispatch a custom event to the mini editor container.
        // This avoids stale React refs — the outer popover's DismissableLayer
        // can cause remounts that invalidate all closure-captured editor refs.
        // The LinkUrlMiniEditor listens for this event and performs the
        // insertion using its live TipTap editor instance.
        document.querySelector('.link-url-editor')?.dispatchEvent(
          new CustomEvent('insert-variable-ref', {
            detail: { fieldId, fieldPath },
          }),
        );
        setOpen(false);
        setSearch('');
      } else if (onInsertVariable) {
        onInsertVariable(fieldId, fieldPath);
        setOpen(false);
        setSearch('');
      } else {
        setOpen(false);
        setSearch('');
        // Defer insert until after Radix popover unmounts and releases focus trap
        requestAnimationFrame(() => {
          const ed = editorRef.current;
          ed.chain().focus().insertVariableRef({ fieldId, fieldPath }).run();
        });
      }
    },
    [inline, onInsertVariable],
  );

  const inlineRef = useRef<HTMLDivElement>(null);

  // When used inside another popover (onInsertVariable provided),
  // render the dropdown inline to avoid nested portal issues.
  // Radix portals nested popover content to document.body, which
  // causes the outer popover's DismissableLayer to treat clicks
  // inside the inner popover as "outside" — dismissing the outer
  // popover and destroying its content (including the mini editor).
  if (inline) {
    return (
      <div className="relative" ref={inlineRef}>
        <Button
          variant={variant}
          className={cn(
            'h-7 rounded-sm focus-visible:ring-0',
            collapsed ? 'w-7 px-0' : 'gap-1 px-2 text-xs font-medium',
          )}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
        >
          {triggerIcon ?? <IconCode className="size-3.5" />}
          {!collapsed && <span>{triggerLabel ?? 'Add variable'}</span>}
        </Button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover shadow-md">
            <VariableCommandList
              variables={variables}
              filteredVariables={filteredVariables}
              search={search}
              setSearch={setSearch}
              onSelect={handleSelect}
              autoFocus
            />
          </div>
        )}
      </div>
    );
  }

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
          {triggerLabel ?? 'Add variable reference'}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" side="bottom" align="start">
        <VariableCommandList
          variables={variables}
          filteredVariables={filteredVariables}
          search={search}
          setSearch={setSearch}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
};
