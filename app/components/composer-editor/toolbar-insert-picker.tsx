'use client';

import { IconCode, IconFileText, IconSparkles } from '@tabler/icons-react';
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
import { useComposerEditorStore } from '~/stores/composer-editor-store';

type ToolbarInsertPickerProps = {
  editor: Editor;
  prompts?: Array<{ id: string; name: string }>;
  onPromptAdded?: (promptId: string, promptName: string) => void;
};

export const ToolbarInsertPicker = ({
  editor,
  prompts,
  onPromptAdded,
}: ToolbarInsertPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const schemaFields = useComposerEditorStore((s) => s.schemaFields);
  const variables = useMemo(
    () => flattenSchemaFields(schemaFields),
    [schemaFields],
  );

  const lower = search.toLowerCase();

  const filteredPrompts = useMemo(() => {
    if (!prompts) return [];
    if (!search) return prompts;
    return prompts.filter((p) => p.name.toLowerCase().includes(lower));
  }, [prompts, search, lower]);

  const filteredVariables = useMemo(() => {
    if (!search) return variables;
    return variables.filter((v) => v.path.toLowerCase().includes(lower));
  }, [variables, search, lower]);

  const handleSelectPrompt = useCallback(
    (promptId: string, promptName: string) => {
      editor.chain().focus().insertPromptRef({ promptId, promptName }).run();
      onPromptAdded?.(promptId, promptName);
      setOpen(false);
      setSearch('');
    },
    [editor, onPromptAdded],
  );

  const handleSelectVariable = useCallback(
    (fieldId: string, fieldPath: string) => {
      editor.chain().focus().insertVariableRef({ fieldId, fieldPath }).run();
      setOpen(false);
      setSearch('');
    },
    [editor],
  );

  const hasResults = filteredPrompts.length > 0 || filteredVariables.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-sm focus-visible:ring-0"
              type="button"
            >
              <IconSparkles className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Insert prompt or variable
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!hasResults && (
              <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                No results found
              </CommandEmpty>
            )}
            {filteredPrompts.length > 0 && (
              <CommandGroup heading="Prompts">
                {filteredPrompts.map((prompt) => (
                  <CommandItem
                    key={`prompt-${prompt.id}`}
                    value={`prompt-${prompt.id}`}
                    onSelect={() => handleSelectPrompt(prompt.id, prompt.name)}
                    className="gap-2 text-sm cursor-pointer"
                  >
                    <IconFileText className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{prompt.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filteredVariables.length > 0 && (
              <CommandGroup heading="Variables">
                {filteredVariables.map((variable) => (
                  <CommandItem
                    key={`var-${variable.id}`}
                    value={`var-${variable.id}`}
                    onSelect={() =>
                      handleSelectVariable(variable.id, variable.path)
                    }
                    className="gap-2 text-sm cursor-pointer"
                  >
                    <IconCode className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{variable.path}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
