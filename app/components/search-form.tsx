import { Search } from 'lucide-react';

import { useSearchContext } from '~/context/search-context';

export const SearchForm = ({ ...props }: React.ComponentProps<'button'>) => {
  const { setOpen } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group bg-muted/50 text-muted-foreground border-input hover:bg-muted hover:border-muted-foreground/20 flex h-9 min-w-[200px] max-w-[260px] items-center gap-2 rounded-lg border px-3 text-sm shadow-sm transition-all duration-150"
      {...props}
    >
      <Search className="size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-70" />
      <span className="flex-1 truncate text-left">Search prompts...</span>
      <kbd className="bg-background text-muted-foreground/70 border-border pointer-events-none hidden h-5 shrink-0 select-none items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-medium shadow-sm sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
};
