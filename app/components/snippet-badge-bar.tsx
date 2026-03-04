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
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AttachedSnippet } from '~/stores/prompt-editor-store';
import { SnippetBadge } from './snippet-badge';

type SortableBadgeProps = {
  snippet: AttachedSnippet;
  readOnly?: boolean;
  onVersionChange: (
    snippetId: string,
    versionId: string | null,
    versionLabel: string | null,
  ) => void;
  onRemove: (snippetId: string) => void;
};

const SortableBadge = ({
  snippet,
  readOnly,
  onVersionChange,
  onRemove,
}: SortableBadgeProps) => {
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
    <span ref={setNodeRef} style={style} {...attributes} className="shrink-0">
      <SnippetBadge
        snippetId={snippet.snippetId}
        snippetName={snippet.snippetName}
        snippetVersionId={snippet.snippetVersionId}
        snippetVersionLabel={snippet.snippetVersionLabel}
        readOnly={readOnly}
        onVersionChange={(versionId, versionLabel) =>
          onVersionChange(snippet.snippetId, versionId, versionLabel)
        }
        onRemove={() => onRemove(snippet.snippetId)}
        dragHandleProps={listeners}
      />
    </span>
  );
};

type SnippetBadgeBarProps = {
  snippets: AttachedSnippet[];
  readOnly?: boolean;
  onReorder: (reordered: AttachedSnippet[]) => void;
  onVersionChange: (
    snippetId: string,
    versionId: string | null,
    versionLabel: string | null,
  ) => void;
  onRemove: (snippetId: string) => void;
};

export const SnippetBadgeBar = ({
  snippets,
  readOnly,
  onReorder,
  onVersionChange,
  onRemove,
}: SnippetBadgeBarProps) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  if (snippets.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = snippets.findIndex((s) => s.snippetId === active.id);
    const newIndex = snippets.findIndex((s) => s.snippetId === over.id);
    const reordered = arrayMove(snippets, oldIndex, newIndex).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));
    onReorder(reordered);
  };

  if (readOnly) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/20 overflow-x-auto flex-nowrap"
        style={{ order: -1 }}
      >
        {snippets.map((snippet) => (
          <span key={snippet.snippetId} className="shrink-0">
            <SnippetBadge
              snippetId={snippet.snippetId}
              snippetName={snippet.snippetName}
              snippetVersionId={snippet.snippetVersionId}
              snippetVersionLabel={snippet.snippetVersionLabel}
              readOnly
            />
          </span>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={snippets.map((s) => s.snippetId)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/20 overflow-x-auto flex-nowrap"
          style={{ order: -1 }}
        >
          {snippets.map((snippet) => (
            <SortableBadge
              key={snippet.snippetId}
              snippet={snippet}
              readOnly={readOnly}
              onVersionChange={onVersionChange}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
