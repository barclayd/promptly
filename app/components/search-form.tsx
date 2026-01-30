import { Search } from 'lucide-react';
import { useSearchContext } from '~/context/search-context';
import { cn } from '~/lib/utils';

type SearchFormProps = React.ComponentProps<'button'> & {
  compact?: boolean;
};

export const SearchForm = ({
  className,
  compact = false,
  ...props
}: SearchFormProps) => {
  const { setOpen } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex h-8 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0',
        compact ? 'w-8 px-2' : 'w-auto sm:w-64 px-2 sm:px-3',
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-2">
        <Search className="size-4 shrink-0" />
        <span className={cn('hidden', !compact && 'sm:inline')}>Search</span>
      </span>
      <kbd
        className={cn(
          'pointer-events-none hidden h-5 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
          !compact && 'sm:inline-flex',
        )}
      >
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
};
