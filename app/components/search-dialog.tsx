import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { matchSorter } from 'match-sorter';
import { FileText, Loader2 } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandLoading,
} from '~/components/ui/command';

type SearchPrompt = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  folderName: string | null;
  url: string;
};

type SearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<SearchPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Ref callback to trigger fetch when dialog opens (input becomes visible)
  const inputRefCallback = (node: HTMLInputElement | null) => {
    if (node && !hasFetchedRef.current && !isFetchingRef.current) {
      isFetchingRef.current = true;
      setLoading(true);
      fetch('/api/search-prompts')
        .then((res) => res.json())
        .then((data: { prompts?: SearchPrompt[] }) => {
          setPrompts(data.prompts || []);
          hasFetchedRef.current = true;
        })
        .catch((e) => {
          console.error('Failed to fetch prompts:', e);
        })
        .finally(() => {
          setLoading(false);
          isFetchingRef.current = false;
        });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSearch('');
    }
  };

  const handleSelect = (prompt: SearchPrompt) => {
    navigate(prompt.url);
    onOpenChange(false);
  };

  const filteredPrompts = search
    ? matchSorter(prompts, search, { keys: ['name', 'description'] })
    : prompts;

  const groupedPrompts = filteredPrompts.reduce(
    (acc, prompt) => {
      const folderKey = prompt.folderName || 'Uncategorized';
      if (!acc[folderKey]) {
        acc[folderKey] = [];
      }
      acc[folderKey].push(prompt);
      return acc;
    },
    {} as Record<string, SearchPrompt[]>,
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        ref={inputRefCallback}
        placeholder="Search prompts..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {loading && (
          <CommandLoading>
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading prompts...</span>
            </div>
          </CommandLoading>
        )}
        {!loading && filteredPrompts.length === 0 && (
          <CommandEmpty>No prompts found.</CommandEmpty>
        )}
        {!loading &&
          Object.entries(groupedPrompts).map(([folderName, folderPrompts]) => (
            <CommandGroup key={folderName} heading={folderName}>
              {folderPrompts.map((prompt) => (
                <CommandItem
                  key={prompt.id}
                  value={prompt.name}
                  onSelect={() => handleSelect(prompt)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{prompt.name}</span>
                    {prompt.description && (
                      <span className="text-muted-foreground text-xs truncate max-w-[400px]">
                        {prompt.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
      </CommandList>
    </CommandDialog>
  );
};
