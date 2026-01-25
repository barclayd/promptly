import { Search } from 'lucide-react';

import { cn } from '~/lib/utils';
import { useSearchContext } from '~/context/search-context';

export const SearchForm = ({
  className,
  ...props
}: React.ComponentProps<'button'>) => {
  const { setOpen } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex h-8 w-64 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-2">
        <Search className="size-4" />
        <span>Search prompts...</span>
      </span>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
};
