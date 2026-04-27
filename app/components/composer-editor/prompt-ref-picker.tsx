'use client';

import { IconFileText, IconPlus } from '@tabler/icons-react';
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
import { cn } from '~/lib/utils';

type PromptRefPickerProps = {
  editor: Editor;
  prompts?: Array<{ id: string; name: string }>;
  collapsed?: boolean;
  onPromptAdded?: (promptId: string, promptName: string) => void;
  /**
   * If provided, replaces the default behaviour of inserting a `promptRef`
   * node into the editor. Use this when the picker is hosted inside a node
   * that owns its own insertion (e.g. the HTML Block's CodeMirror surface).
   */
  customInsert?: (promptId: string, promptName: string) => void;
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
};

export const PromptRefPicker = ({
  editor,
  prompts,
  collapsed,
  onPromptAdded,
  customInsert,
  triggerLabel,
  triggerIcon,
}: PromptRefPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPrompts = useMemo(() => {
    if (!prompts) return [];
    if (!search) return prompts;
    const lower = search.toLowerCase();
    return prompts.filter((p) => p.name.toLowerCase().includes(lower));
  }, [prompts, search]);

  const handleSelect = useCallback(
    (promptId: string, promptName: string) => {
      if (customInsert) {
        customInsert(promptId, promptName);
      } else {
        editor.chain().focus().insertPromptRef({ promptId, promptName }).run();
        onPromptAdded?.(promptId, promptName);
      }
      setOpen(false);
      setSearch('');
    },
    [editor, onPromptAdded, customInsert],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'h-7 rounded-sm focus-visible:ring-0',
                collapsed ? 'w-7 px-0' : 'gap-1 px-2 text-xs font-medium',
              )}
              type="button"
            >
              {triggerIcon ?? <IconFileText className="size-3.5" />}
              {!collapsed && <span>{triggerLabel ?? 'Add prompt'}</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {triggerLabel ?? 'Add prompt reference'}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search prompts..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {!prompts
                ? 'Loading prompts...'
                : prompts.length === 0
                  ? 'No prompts available'
                  : 'No matching prompts'}
            </CommandEmpty>
            <CommandGroup>
              {filteredPrompts.map((prompt) => (
                <CommandItem
                  key={prompt.id}
                  value={prompt.id}
                  onSelect={() => handleSelect(prompt.id, prompt.name)}
                  className="gap-2 text-sm cursor-pointer"
                >
                  <IconFileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{prompt.name}</span>
                  <IconPlus className="size-3 ml-auto text-muted-foreground/60 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
