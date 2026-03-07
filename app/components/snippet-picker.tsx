import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconArrowLeft,
  IconCheck,
  IconGripVertical,
  IconPin,
  IconPlus,
  IconPuzzle,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
import { cn } from '~/lib/utils';
import type { AttachedSnippet } from '~/stores/prompt-editor-store';

type SearchSnippetItem = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  folderName: string | null;
};

type SnippetVersion = {
  id: string;
  major: number;
  minor: number;
  patch: number;
  publishedAt: number;
};

type SnippetPickerProps = {
  attachedSnippets: AttachedSnippet[];
  readOnly?: boolean;
  onSelect: (snippetId: string, snippetName: string) => void;
  onRemove: (snippetId: string) => void;
  onReorder: (reordered: AttachedSnippet[]) => void;
  onVersionChange: (
    snippetId: string,
    versionId: string | null,
    versionLabel: string | null,
  ) => void;
};

type SortableSnippetRowProps = {
  snippet: AttachedSnippet;
  onClickRow: (snippetId: string) => void;
};

const SortableSnippetRow = ({
  snippet,
  onClickRow,
}: SortableSnippetRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: snippet.snippetId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
      onClick={() => onClickRow(snippet.snippetId)}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle needs event listeners from dnd-kit */}
      <span
        className="cursor-grab text-muted-foreground/60 hover:text-muted-foreground touch-none"
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <IconGripVertical className="size-3.5" />
      </span>
      <IconPuzzle className="size-3.5 text-emerald-500 shrink-0" />
      <span className="truncate flex-1">{snippet.snippetName}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {snippet.snippetVersionLabel ?? 'Latest'}
      </span>
    </button>
  );
};

export const SnippetPicker = ({
  attachedSnippets,
  readOnly,
  onSelect,
  onRemove,
  onReorder,
  onVersionChange,
}: SnippetPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(
    null,
  );
  const [versionSearch, setVersionSearch] = useState('');

  const snippetsRef = useRef<SearchSnippetItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const versionsRef = useRef<Record<string, SnippetVersion[]>>({});
  const [versionsLoading, setVersionsLoading] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const hasSnippets = attachedSnippets.length > 0;
  const attachedIds = useMemo(
    () => new Set(attachedSnippets.map((s) => s.snippetId)),
    [attachedSnippets],
  );

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

  const fetchVersions = (snippetId: string) => {
    if (versionsRef.current[snippetId]) return;
    setVersionsLoading(true);
    fetch(`/api/snippet-versions?snippetId=${snippetId}`)
      .then((res) => res.json() as Promise<{ versions: SnippetVersion[] }>)
      .then((data) => {
        versionsRef.current[snippetId] = data.versions;
      })
      .catch(() => {
        versionsRef.current[snippetId] = [];
      })
      .finally(() => {
        setVersionsLoading(false);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: versionsLoading triggers re-computation when ref updates
  const filteredVersions = useMemo(() => {
    if (!selectedSnippetId) return [];
    const versions = versionsRef.current[selectedSnippetId] ?? [];
    if (!versionSearch) return versions;
    const lower = versionSearch.toLowerCase();
    return versions.filter((v) =>
      `v${v.major}.${v.minor}.${v.patch}`.toLowerCase().includes(lower),
    );
  }, [selectedSnippetId, versionSearch, versionsLoading]);

  const selectedSnippet = attachedSnippets.find(
    (s) => s.snippetId === selectedSnippetId,
  );
  const selectedSnippetName =
    selectedSnippet?.snippetName ??
    snippetsRef.current?.find((s) => s.id === selectedSnippetId)?.name ??
    'Snippet';

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      fetchSnippets();
    } else {
      setSelectedSnippetId(null);
      setSearch('');
      setVersionSearch('');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = attachedSnippets.findIndex(
      (s) => s.snippetId === active.id,
    );
    const newIndex = attachedSnippets.findIndex((s) => s.snippetId === over.id);
    const reordered = arrayMove(attachedSnippets, oldIndex, newIndex).map(
      (s, i) => ({
        ...s,
        sortOrder: i,
      }),
    );
    onReorder(reordered);
  };

  const handleSelectSnippet = (snippetId: string, snippetName: string) => {
    if (attachedIds.has(snippetId)) return;
    onSelect(snippetId, snippetName);
  };

  const handleRowClick = (snippetId: string) => {
    setSelectedSnippetId(snippetId);
    setVersionSearch('');
    fetchVersions(snippetId);
  };

  const handleBack = () => {
    setSelectedSnippetId(null);
    setVersionSearch('');
  };

  const handleVersionSelect = (
    versionId: string | null,
    versionLabel: string | null,
  ) => {
    if (readOnly || !selectedSnippetId) return;
    onVersionChange(selectedSnippetId, versionId, versionLabel);
  };

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (selectedSnippetId) {
      e.preventDefault();
      handleBack();
    }
  };

  const renderVersionPicker = () => {
    const currentVersionId = selectedSnippet?.snippetVersionId ?? null;

    return (
      <Command shouldFilter={false}>
        <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft className="size-3.5" />
          </button>
          <IconPuzzle className="size-3.5 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium truncate">
            {selectedSnippetName}
          </span>
        </div>
        <CommandInput
          placeholder="Search versions..."
          value={versionSearch}
          onValueChange={setVersionSearch}
        />
        <CommandList>
          <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
            {versionsLoading ? 'Loading versions...' : 'No matching versions'}
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="latest"
              onSelect={
                readOnly ? undefined : () => handleVersionSelect(null, null)
              }
              disabled={readOnly}
              className="gap-2 text-sm cursor-pointer"
            >
              <span className="flex-1">
                <span className="font-medium">Latest</span>
                <span className="block text-xs text-muted-foreground">
                  Always uses the latest published version
                </span>
              </span>
              {currentVersionId === null && (
                <IconPin className="size-3.5 text-emerald-500 shrink-0" />
              )}
            </CommandItem>
          </CommandGroup>
          {filteredVersions.length > 0 && (
            <CommandGroup heading="Published Versions">
              {filteredVersions.map((v) => {
                const label = `v${v.major}.${v.minor}.${v.patch}`;
                const isSelected = currentVersionId === v.id;
                return (
                  <CommandItem
                    key={v.id}
                    value={v.id}
                    onSelect={
                      readOnly
                        ? undefined
                        : () => handleVersionSelect(v.id, label)
                    }
                    disabled={readOnly}
                    className="gap-2 text-sm cursor-pointer"
                  >
                    <span className="truncate flex-1">{label}</span>
                    {isSelected && (
                      <IconPin className="size-3.5 text-emerald-500 shrink-0" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {!readOnly && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="remove"
                  onSelect={() => {
                    if (!selectedSnippetId) return;
                    onRemove(selectedSnippetId);
                    handleBack();
                  }}
                  className="gap-2 text-sm cursor-pointer text-destructive"
                >
                  <IconTrash className="size-3.5" />
                  <span>Remove snippet</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    );
  };

  const renderMainView = () => (
    <>
      {hasSnippets && (
        <div className="p-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Active Snippets
          </div>
          {readOnly ? (
            attachedSnippets.map((snippet) => (
              <button
                type="button"
                key={snippet.snippetId}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
                onClick={() => handleRowClick(snippet.snippetId)}
              >
                <IconPuzzle className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate flex-1">{snippet.snippetName}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {snippet.snippetVersionLabel ?? 'Latest'}
                </span>
              </button>
            ))
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={attachedSnippets.map((s) => s.snippetId)}
                strategy={verticalListSortingStrategy}
              >
                {attachedSnippets.map((snippet) => (
                  <SortableSnippetRow
                    key={snippet.snippetId}
                    snippet={snippet}
                    onClickRow={handleRowClick}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
      {!readOnly && (
        <>
          {hasSnippets && <div className="border-b" />}
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
              <CommandGroup heading="Available Snippets">
                {filteredSnippets.map((snippet) => {
                  const isAttached = attachedIds.has(snippet.id);
                  return (
                    <CommandItem
                      key={snippet.id}
                      value={snippet.id}
                      onSelect={() =>
                        handleSelectSnippet(snippet.id, snippet.name)
                      }
                      disabled={isAttached}
                      className="gap-2 text-sm cursor-pointer"
                    >
                      <IconPuzzle className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{snippet.name}</span>
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
        </>
      )}
    </>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <InputGroupButton variant="ghost" size="icon-xs">
              <IconPuzzle className={cn(hasSnippets && 'text-emerald-500')} />
            </InputGroupButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {hasSnippets ? 'Manage snippets' : 'Attach snippet'}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-72 p-0"
        side="bottom"
        align="start"
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        {selectedSnippetId ? renderVersionPicker() : renderMainView()}
      </PopoverContent>
    </Popover>
  );
};
