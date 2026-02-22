import { IconChevronDown, IconFileText, IconPin } from '@tabler/icons-react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
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

type PromptVersion = {
  id: string;
  major: number;
  minor: number;
  patch: number;
};

export const PromptRefBadge = ({
  node,
  selected,
  editor,
}: ReactNodeViewProps) => {
  const promptId = node.attrs.promptId as string;
  const promptName = node.attrs.promptName as string;
  const promptVersionId = node.attrs.promptVersionId as string | null;
  const promptVersionLabel = node.attrs.promptVersionLabel as string | null;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const versionsRef = useRef<PromptVersion[] | null>(null);

  const isPinned = promptVersionId !== null;
  const readOnly = !editor.isEditable;

  const displayText = isPinned
    ? `${promptName || promptId}: ${promptVersionLabel ?? ''}`
    : promptName || promptId;

  const maxWidthClass = isPinned ? 'max-w-[250px]' : 'max-w-[150px]';

  const prefetchVersions = () => {
    if (versionsRef.current !== null) return;

    setLoading(true);
    fetch(`/api/prompt-versions?promptId=${encodeURIComponent(promptId)}`)
      .then((res) => res.json() as Promise<{ versions: PromptVersion[] }>)
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
    editor.commands.updatePromptVersionPin({
      promptId,
      promptVersionId: null,
      promptVersionLabel: null,
    });
    setOpen(false);
  };

  const handleSelectVersion = (version: PromptVersion) => {
    if (readOnly) return;
    editor.commands.updatePromptVersionPin({
      promptId,
      promptVersionId: version.id,
      promptVersionLabel: `v${version.major}.${version.minor}.${version.patch}`,
    });
    setOpen(false);
  };

  return (
    <NodeViewWrapper as="span" className="inline mx-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter is for prefetching, not user interaction */}
          <span
            className={cn(
              'inline-flex items-center rounded-full border text-xs font-medium align-baseline',
              'text-blue-600 border-blue-500/20',
              'dark:text-blue-400 dark:border-blue-500/30',
              isPinned
                ? 'bg-blue-500/20 dark:bg-blue-500/25'
                : 'bg-blue-500/10 dark:bg-blue-500/15',
              selected && 'ring-2 ring-blue-500/40 ring-offset-1',
            )}
            contentEditable={false}
            onMouseEnter={prefetchVersions}
          >
            <span
              data-drag-handle
              className="inline-flex items-center gap-1 cursor-grab pl-2 pr-1.5 py-0.5"
            >
              <IconFileText className="size-3 shrink-0" />
              <span className={cn('truncate', maxWidthClass)}>
                {displayText}
              </span>
            </span>

            <button
              type="button"
              className={cn(
                'flex items-center border-l pl-1 pr-1.5 py-0.5 rounded-r-full cursor-pointer',
                'border-blue-500/20 dark:border-blue-500/30',
                'hover:bg-blue-500/10 dark:hover:bg-blue-500/15',
              )}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen((prev) => !prev);
              }}
            >
              <IconChevronDown className="size-3" />
            </button>
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
                  {!promptVersionId && (
                    <IconPin className="ml-auto size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
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
                        {promptVersionId === version.id && (
                          <IconPin className="ml-auto size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        )}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
};
