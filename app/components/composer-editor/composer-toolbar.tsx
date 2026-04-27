'use client';

import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBlockquote,
  IconBrandHtml5,
  IconCode,
  IconHighlight,
  IconLetterCase,
  IconLine,
  IconLink,
  IconTable,
} from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  ADD_PROMPT_FULL_WIDTH,
  ADD_VARIABLE_FULL_WIDTH,
  DROPDOWN_TRIGGER_WIDTH,
  ICON_BUTTON_WIDTH,
  useToolbarOverflow,
} from '~/hooks/use-toolbar-overflow';
import { cn } from '~/lib/utils';
import { ColorPalettePopover } from './color-palette-popover';
import { LinkEditPopover } from './link-edit-popover';
import { PromptRefPicker } from './prompt-ref-picker';
import { TableInsertPopover } from './table-insert-popover';
import { ToolbarAlignmentDropdown } from './toolbar-alignment-dropdown';
import { ToolbarHeadingDropdown } from './toolbar-heading-dropdown';
import { ToolbarInsertPicker } from './toolbar-insert-picker';
import { ToolbarListDropdown } from './toolbar-list-dropdown';
import { ToolbarMarksDropdown } from './toolbar-marks-dropdown';
import { ToolbarOverflowMenu } from './toolbar-overflow-menu';
import { ToolbarToolsDropdown } from './toolbar-tools-dropdown';
import { VariableRefPicker } from './variable-ref-picker';

// Exported so the overflow menu can use it
export type OverflowItemDef = {
  id: string;
  groupId: string;
  groupLabel: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  isActive?: (editor: Editor) => boolean;
  action: (editor: Editor) => void;
};

const ToolbarSeparator = () => (
  <div className="mx-1 h-4 w-px shrink-0 bg-border" />
);

// Define all overflowable items with their overflow priority and group info.
// Lower priority = overflows first. Infinity = never overflow (pinned).
const TOOLBAR_ITEMS = [
  // --- Pinned (never overflow) ---
  {
    id: 'heading-dropdown',
    groupId: 'heading',
    overflowPriority: Number.POSITIVE_INFINITY,
    estimatedWidth: DROPDOWN_TRIGGER_WIDTH,
  },
  {
    id: 'list-dropdown',
    groupId: 'list',
    overflowPriority: Number.POSITIVE_INFINITY,
    estimatedWidth: DROPDOWN_TRIGGER_WIDTH,
  },
  {
    id: 'marks-dropdown',
    groupId: 'marks',
    overflowPriority: Number.POSITIVE_INFINITY,
    estimatedWidth: DROPDOWN_TRIGGER_WIDTH,
  },
  // --- Overflowable (ordered by priority, highest = stays longest) ---
  {
    id: 'add-prompt',
    groupId: 'insert',
    overflowPriority: 6,
    estimatedWidth: ADD_PROMPT_FULL_WIDTH,
  },
  {
    id: 'add-variable',
    groupId: 'insert',
    overflowPriority: 6,
    estimatedWidth: ADD_VARIABLE_FULL_WIDTH,
  },
  {
    id: 'link',
    groupId: 'link',
    overflowPriority: 5,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'text-color',
    groupId: 'colors',
    overflowPriority: 4,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'highlight',
    groupId: 'colors',
    overflowPriority: 4,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'alignment-dropdown',
    groupId: 'alignment',
    overflowPriority: 3,
    estimatedWidth: DROPDOWN_TRIGGER_WIDTH,
  },
  {
    id: 'tools-dropdown',
    groupId: 'tools',
    overflowPriority: 2,
    estimatedWidth: DROPDOWN_TRIGGER_WIDTH,
  },
  {
    id: 'table',
    groupId: 'table',
    overflowPriority: 1,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
];

// Overflow definitions for items that can appear in the overflow dropdown
const OVERFLOW_DEFS: OverflowItemDef[] = [
  {
    id: 'link',
    groupId: 'link',
    groupLabel: 'Insert',
    label: 'Link',
    Icon: IconLink,
    isActive: (e) => e.isActive('link'),
    action: () => {
      // Link in overflow is handled via setLinkOpen — see below
    },
  },
  {
    id: 'text-color',
    groupId: 'colors',
    groupLabel: 'Colors',
    label: 'Text Color',
    Icon: IconLetterCase,
    isActive: (e) => e.isActive('textStyle'),
    action: () => {},
  },
  {
    id: 'highlight',
    groupId: 'colors',
    groupLabel: 'Colors',
    label: 'Highlight',
    Icon: IconHighlight,
    isActive: (e) => e.isActive('highlight'),
    action: () => {},
  },
  // Alignment items — shown in overflow when alignment-dropdown overflows
  {
    id: 'align-left',
    groupId: 'alignment',
    groupLabel: 'Alignment',
    label: 'Align Left',
    Icon: IconAlignLeft,
    isActive: (e) => e.isActive({ textAlign: 'left' }),
    action: (e) => e.chain().focus().setTextAlign('left').run(),
  },
  {
    id: 'align-center',
    groupId: 'alignment',
    groupLabel: 'Alignment',
    label: 'Align Center',
    Icon: IconAlignCenter,
    isActive: (e) => e.isActive({ textAlign: 'center' }),
    action: (e) => e.chain().focus().setTextAlign('center').run(),
  },
  {
    id: 'align-right',
    groupId: 'alignment',
    groupLabel: 'Alignment',
    label: 'Align Right',
    Icon: IconAlignRight,
    isActive: (e) => e.isActive({ textAlign: 'right' }),
    action: (e) => e.chain().focus().setTextAlign('right').run(),
  },
  // Block items — shown in overflow when tools-dropdown overflows
  {
    id: 'blockquote',
    groupId: 'blocks',
    groupLabel: 'Blocks',
    label: 'Blockquote',
    Icon: IconBlockquote,
    isActive: (e) => e.isActive('blockquote'),
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code-block',
    groupId: 'blocks',
    groupLabel: 'Blocks',
    label: 'Code Block',
    Icon: IconCode,
    isActive: (e) => e.isActive('codeBlock'),
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'horizontal-rule',
    groupId: 'blocks',
    groupLabel: 'Blocks',
    label: 'Horizontal Rule',
    Icon: IconLine,
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'html-block',
    groupId: 'blocks',
    groupLabel: 'Blocks',
    label: 'HTML Block',
    Icon: IconBrandHtml5,
    isActive: (e) => e.isActive('htmlBlock'),
    action: (e) => e.chain().focus().insertHtmlBlock().run(),
  },
  {
    id: 'table',
    groupId: 'table',
    groupLabel: 'Table',
    label: 'Table',
    Icon: IconTable,
    isActive: (e) => e.isActive('table'),
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
];

// The ordered list of items to render in the toolbar
// Order: H∨ | List∨ | BIUS∨ | Link | TextColor Highlight | Align∨ | Tools∨ | Table | ✨ Add prompt | ✨ Add variable
const RENDER_ORDER = [
  'heading-dropdown',
  'list-dropdown',
  'marks-dropdown',
  'link',
  'text-color',
  'highlight',
  'alignment-dropdown',
  'tools-dropdown',
  'table',
  'add-prompt',
  'add-variable',
];

// Map dropdown IDs to the overflow group IDs they expand into
const DROPDOWN_TO_GROUP: Record<string, string> = {
  'alignment-dropdown': 'alignment',
  'tools-dropdown': 'blocks',
};

type ComposerToolbarProps = {
  editor: Editor | null;
  prompts?: Array<{ id: string; name: string }>;
  onPromptAdded?: (promptId: string, promptName: string) => void;
};

export const ComposerToolbar = ({
  editor,
  prompts,
  onPromptAdded,
}: ComposerToolbarProps) => {
  const [linkOpen, setLinkOpen] = useState(false);

  const {
    ref,
    visibleIds,
    overflowIds,
    hasOverflow,
    addPromptCollapsed,
    addVariableCollapsed,
    insertMerged,
  } = useToolbarOverflow(TOOLBAR_ITEMS);

  const handleSetLink = useCallback(
    (url: string) => {
      if (!editor) return;
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }
      setLinkOpen(false);
    },
    [editor],
  );

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  // Build overflow items with link action wired up
  const overflowItems = useMemo(() => {
    // Collect overflow group IDs from overflowed dropdowns
    const expandedGroups = new Set<string>();
    for (const id of overflowIds) {
      const group = DROPDOWN_TO_GROUP[id];
      if (group) expandedGroups.add(group);
    }

    const items = OVERFLOW_DEFS.filter(
      (d) => overflowIds.has(d.id) || expandedGroups.has(d.groupId),
    );
    // Wire up link action to open the popover
    return items.map((item) => {
      if (item.id === 'link') {
        return { ...item, action: () => setLinkOpen(true) };
      }
      return item;
    });
  }, [overflowIds]);

  if (!editor) return null;

  const currentLinkUrl = editor.getAttributes('link').href ?? '';

  // Build the visible items to render, based on RENDER_ORDER
  // When insertMerged is true, skip individual add-prompt/add-variable
  const visibleOrderedIds = RENDER_ORDER.filter((id) => {
    if (!visibleIds.has(id)) return false;
    if (insertMerged && (id === 'add-prompt' || id === 'add-variable'))
      return false;
    return true;
  });

  // Get groupId for an item id
  const getGroupId = (id: string) => {
    if (id === 'insert-merged') return 'insert';
    return TOOLBAR_ITEMS.find((i) => i.id === id)?.groupId ?? '';
  };

  // Render an inline toolbar item by id
  const renderItem = (id: string) => {
    switch (id) {
      case 'heading-dropdown':
        return <ToolbarHeadingDropdown editor={editor} />;
      case 'list-dropdown':
        return <ToolbarListDropdown editor={editor} />;
      case 'marks-dropdown':
        return <ToolbarMarksDropdown editor={editor} />;
      case 'link':
        return (
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 rounded-sm focus-visible:ring-0',
                  editor.isActive('link') && 'bg-accent text-accent-foreground',
                )}
                type="button"
              >
                <IconLink className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" side="bottom" align="start">
              <LinkEditPopover
                url={currentLinkUrl}
                onSetLink={handleSetLink}
                onRemoveLink={handleRemoveLink}
                hasLink={editor.isActive('link')}
              />
            </PopoverContent>
          </Popover>
        );
      case 'text-color':
        return (
          <ColorPalettePopover
            type="text"
            editor={editor}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 rounded-sm focus-visible:ring-0',
                  editor.isActive('textStyle') &&
                    'bg-accent text-accent-foreground',
                )}
                type="button"
              >
                <IconLetterCase className="size-4" />
              </Button>
            }
          />
        );
      case 'highlight':
        return (
          <ColorPalettePopover
            type="highlight"
            editor={editor}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 rounded-sm focus-visible:ring-0',
                  editor.isActive('highlight') &&
                    'bg-accent text-accent-foreground',
                )}
                type="button"
              >
                <IconHighlight className="size-4" />
              </Button>
            }
          />
        );
      case 'alignment-dropdown':
        return <ToolbarAlignmentDropdown editor={editor} />;
      case 'tools-dropdown':
        return <ToolbarToolsDropdown editor={editor} />;
      case 'table':
        return <TableInsertPopover editor={editor} />;
      case 'add-prompt':
        return (
          <PromptRefPicker
            editor={editor}
            prompts={prompts}
            collapsed={addPromptCollapsed}
            onPromptAdded={onPromptAdded}
          />
        );
      case 'add-variable':
        return (
          <VariableRefPicker editor={editor} collapsed={addVariableCollapsed} />
        );
      case 'insert-merged':
        return (
          <ToolbarInsertPicker
            editor={editor}
            prompts={prompts}
            onPromptAdded={onPromptAdded}
          />
        );
      default:
        return null;
    }
  };

  // If insertMerged, append the merged button id to the visible list
  const finalOrderedIds = insertMerged
    ? [...visibleOrderedIds, 'insert-merged']
    : visibleOrderedIds;

  return (
    <div
      ref={ref}
      className="flex flex-1 min-w-0 items-center gap-0.5 overflow-hidden"
    >
      {finalOrderedIds.map((id, i) => {
        const prevId = finalOrderedIds[i - 1];
        const needsSep =
          i > 0 && prevId && getGroupId(prevId) !== getGroupId(id);
        return (
          <Fragment key={id}>
            {needsSep && <ToolbarSeparator />}
            {renderItem(id)}
          </Fragment>
        );
      })}
      {hasOverflow && (
        <>
          <ToolbarSeparator />
          <ToolbarOverflowMenu editor={editor} items={overflowItems} />
        </>
      )}
      {/* Hidden link popover anchor for when link is in overflow */}
      {overflowIds.has('link') && linkOpen && (
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <span className="sr-only" />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" side="bottom" align="start">
            <LinkEditPopover
              url={currentLinkUrl}
              onSetLink={handleSetLink}
              onRemoveLink={handleRemoveLink}
              hasLink={editor.isActive('link')}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
