import { IconCheck, IconPlus, IconPuzzle } from '@tabler/icons-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import { InputGroupButton } from '~/components/ui/input-group';
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

type SearchSnippetItem = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  folderName: string | null;
};

type SnippetPickerProps = {
  attachedSnippetIds: Set<string>;
  onSelect: (snippetId: string, snippetName: string) => void;
};

export const SnippetPicker = ({
  attachedSnippetIds,
  onSelect,
}: SnippetPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const snippetsRef = useRef<SearchSnippetItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSnippets = () => {
    if (snippetsRef.current !== null) return;
    setLoading(true);
    fetch('/api/search-snippets')
      .then((res) => res.json() as Promise<{ snippets: SearchSnippetItem[] }>)
      .then((data) => {
        snippetsRef.current = data.snippets;
      })
      .catch(() => {
        snippetsRef.current = [];
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loading triggers re-computation when ref updates
  const filteredSnippets = useMemo(() => {
    if (!snippetsRef.current) return [];
    if (!search) return snippetsRef.current;
    const lower = search.toLowerCase();
    return snippetsRef.current.filter((s) =>
      s.name.toLowerCase().includes(lower),
    );
  }, [search, loading]);

  const handleSelect = useCallback(
    (snippetId: string, snippetName: string) => {
      if (attachedSnippetIds.has(snippetId)) return;
      onSelect(snippetId, snippetName);
      setOpen(false);
      setSearch('');
    },
    [attachedSnippetIds, onSelect],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      fetchSnippets();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <InputGroupButton variant="ghost" size="icon-xs">
              <IconPuzzle />
            </InputGroupButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Attach snippet
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search snippets..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {loading
                ? 'Loading snippets...'
                : !snippetsRef.current || snippetsRef.current.length === 0
                  ? 'No published snippets'
                  : 'No matching snippets'}
            </CommandEmpty>
            <CommandGroup>
              {filteredSnippets.map((snippet) => {
                const isAttached = attachedSnippetIds.has(snippet.id);
                return (
                  <CommandItem
                    key={snippet.id}
                    value={snippet.id}
                    onSelect={() => handleSelect(snippet.id, snippet.name)}
                    disabled={isAttached}
                    className="gap-2 text-sm cursor-pointer"
                  >
                    <IconPuzzle className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{snippet.name}</span>
                    {isAttached ? (
                      <IconCheck className="size-3 ml-auto text-emerald-500 shrink-0" />
                    ) : (
                      <IconPlus className="size-3 ml-auto text-muted-foreground/60 shrink-0" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
