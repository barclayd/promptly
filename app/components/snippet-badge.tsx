import {
  IconChevronDown,
  IconGripVertical,
  IconPin,
  IconPuzzle,
  IconTrash,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

type SnippetVersion = {
  id: string;
  major: number;
  minor: number;
  patch: number;
};

type SnippetBadgeProps = {
  snippetId: string;
  snippetName: string;
  snippetVersionId: string | null;
  snippetVersionLabel: string | null;
  readOnly?: boolean;
  onVersionChange?: (
    versionId: string | null,
    versionLabel: string | null,
  ) => void;
  onRemove?: () => void;
  dragHandleProps?: Record<string, unknown>;
};

export const SnippetBadge = ({
  snippetId,
  snippetName,
  snippetVersionId,
  snippetVersionLabel,
  readOnly,
  onVersionChange,
  onRemove,
  dragHandleProps,
}: SnippetBadgeProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const versionsRef = useRef<SnippetVersion[] | null>(null);

  const isPinned = snippetVersionId !== null;

  const displayText = isPinned
    ? `${snippetName}: ${snippetVersionLabel ?? ''}`
    : snippetName;

  const maxWidthClass = isPinned ? 'max-w-[250px]' : 'max-w-[150px]';

  const prefetchVersions = () => {
    if (versionsRef.current !== null) return;
    setLoading(true);
    fetch(`/api/snippet-versions?snippetId=${encodeURIComponent(snippetId)}`)
      .then((res) => res.json() as Promise<{ versions: SnippetVersion[] }>)
      .then((data) => {
        versionsRef.current = data.versions;
      })
      .catch(() => {
        versionsRef.current = [];
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSelectLatest = () => {
    if (readOnly) return;
    onVersionChange?.(null, null);
    setOpen(false);
  };

  const handleSelectVersion = (version: SnippetVersion) => {
    if (readOnly) return;
    onVersionChange?.(
      version.id,
      `v${version.major}.${version.minor}.${version.patch}`,
    );
    setOpen(false);
  };

  const handleRemove = () => {
    if (readOnly) return;
    onRemove?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter is for prefetching */}
        <span
          className={cn(
            'inline-flex items-center rounded-full border text-xs font-medium',
            'text-emerald-600 border-emerald-500/20',
            'dark:text-emerald-400 dark:border-emerald-500/30',
            isPinned
              ? 'bg-emerald-500/20 dark:bg-emerald-500/25'
              : 'bg-emerald-500/10 dark:bg-emerald-500/15',
          )}
          onMouseEnter={prefetchVersions}
        >
          {!readOnly && (
            <span
              className="inline-flex items-center pl-1 cursor-grab"
              {...dragHandleProps}
            >
              <IconGripVertical className="size-3 text-emerald-600/50 dark:text-emerald-400/50" />
            </span>
          )}

          <span
            className={cn(
              'inline-flex items-center gap-1 py-0.5',
              readOnly ? 'pl-2 pr-1.5' : 'pl-0.5 pr-1.5',
            )}
          >
            <IconPuzzle className="size-3 shrink-0" />
            <span className={cn('truncate', maxWidthClass)}>{displayText}</span>
          </span>

          {!readOnly && (
            <button
              type="button"
              className={cn(
                'flex items-center border-l pl-1 pr-1.5 py-0.5 rounded-r-full cursor-pointer',
                'border-emerald-500/20 dark:border-emerald-500/30',
                'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
              )}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen((prev) => !prev);
              }}
            >
              <IconChevronDown className="size-3" />
            </button>
          )}
        </span>
      </PopoverAnchor>

      <PopoverContent align="start" sideOffset={5} className="p-0 w-[220px]">
        <Command>
          <CommandInput placeholder="Search versions..." />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="latest"
                onSelect={handleSelectLatest}
                disabled={readOnly}
              >
                <div className="flex flex-col">
                  <span>Latest</span>
                  <span className="text-muted-foreground text-[10px]">
                    Always uses most recent published version
                  </span>
                </div>
                {!snippetVersionId && (
                  <IconPin className="ml-auto size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Published Versions">
              {loading && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Loading versions...
                </div>
              )}

              {!loading &&
                versionsRef.current !== null &&
                versionsRef.current.length === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No published versions yet
                  </div>
                )}

              {!loading &&
                versionsRef.current?.map((version) => {
                  const label = `v${version.major}.${version.minor}.${version.patch}`;
                  return (
                    <CommandItem
                      key={version.id}
                      value={label}
                      onSelect={() => handleSelectVersion(version)}
                      disabled={readOnly}
                    >
                      <span>{label}</span>
                      {snippetVersionId === version.id && (
                        <IconPin className="ml-auto size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup>
              <CommandItem
                value="remove"
                onSelect={handleRemove}
                disabled={readOnly}
                className="text-destructive"
              >
                <IconTrash className="size-3.5 shrink-0" />
                <span>Remove snippet</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
