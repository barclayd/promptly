'use client';

import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBlockquote,
  IconBold,
  IconCode,
  IconHighlight,
  IconItalic,
  IconLetterCase,
  IconLine,
  IconLink,
  IconStrikethrough,
  IconTable,
  IconUnderline,
} from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Separator } from '~/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import {
  ADD_PROMPT_FULL_WIDTH,
  DROPDOWN_TRIGGER_WIDTH,
  ICON_BUTTON_WIDTH,
  useToolbarOverflow,
} from '~/hooks/use-toolbar-overflow';
import { cn } from '~/lib/utils';
import { ColorPalettePopover } from './color-palette-popover';
import { LinkEditPopover } from './link-edit-popover';
import { PromptRefPicker } from './prompt-ref-picker';
import { TableInsertPopover } from './table-insert-popover';
import { ToolbarHeadingDropdown } from './toolbar-heading-dropdown';
import { ToolbarListDropdown } from './toolbar-list-dropdown';
import { ToolbarOverflowMenu } from './toolbar-overflow-menu';

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

type ToolbarButtonProps = {
  icon: React.ReactNode;
  tooltip: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

const ToolbarButton = ({
  icon,
  tooltip,
  isActive,
  onClick,
  disabled,
}: ToolbarButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'size-7 rounded-sm',
          isActive && 'bg-accent text-accent-foreground',
        )}
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-xs">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

const ToolbarSeparator = () => (
  <Separator orientation="vertical" className="mx-0.5 h-5" />
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
    id: 'bold',
    groupId: 'marks',
    overflowPriority: Number.POSITIVE_INFINITY,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'add-prompt',
    groupId: 'prompt',
    overflowPriority: Number.POSITIVE_INFINITY,
    estimatedWidth: ADD_PROMPT_FULL_WIDTH,
  },
  // --- Overflowable (ordered by priority, highest = stays longest) ---
  {
    id: 'italic',
    groupId: 'marks',
    overflowPriority: 7,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'underline',
    groupId: 'marks',
    overflowPriority: 6,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'strikethrough',
    groupId: 'marks',
    overflowPriority: 6,
    estimatedWidth: ICON_BUTTON_WIDTH,
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
    id: 'align-left',
    groupId: 'alignment',
    overflowPriority: 3,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'align-center',
    groupId: 'alignment',
    overflowPriority: 3,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'align-right',
    groupId: 'alignment',
    overflowPriority: 3,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'blockquote',
    groupId: 'blocks',
    overflowPriority: 2,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'code-block',
    groupId: 'blocks',
    overflowPriority: 2,
    estimatedWidth: ICON_BUTTON_WIDTH,
  },
  {
    id: 'horizontal-rule',
    groupId: 'blocks',
    overflowPriority: 2,
    estimatedWidth: ICON_BUTTON_WIDTH,
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
    id: 'italic',
    groupId: 'marks',
    groupLabel: 'Text',
    label: 'Italic',
    Icon: IconItalic,
    isActive: (e) => e.isActive('italic'),
    action: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline',
    groupId: 'marks',
    groupLabel: 'Text',
    label: 'Underline',
    Icon: IconUnderline,
    isActive: (e) => e.isActive('underline'),
    action: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'strikethrough',
    groupId: 'marks',
    groupLabel: 'Text',
    label: 'Strikethrough',
    Icon: IconStrikethrough,
    isActive: (e) => e.isActive('strike'),
    action: (e) => e.chain().focus().toggleStrike().run(),
  },
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
// Order: H∨ | List∨ | B I U S | Link | TextColor Highlight | AlignL AlignC AlignR | Blockquote Code HR | Table | + Add prompt | ▸ overflow
const RENDER_ORDER = [
  'heading-dropdown',
  'list-dropdown',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'link',
  'text-color',
  'highlight',
  'align-left',
  'align-center',
  'align-right',
  'blockquote',
  'code-block',
  'horizontal-rule',
  'table',
  'add-prompt',
];

type ComposerToolbarProps = {
  editor: Editor | null;
  prompts?: Array<{ id: string; name: string }>;
};

export const ComposerToolbar = ({ editor, prompts }: ComposerToolbarProps) => {
  const [linkOpen, setLinkOpen] = useState(false);

  const { ref, visibleIds, overflowIds, hasOverflow, addPromptCollapsed } =
    useToolbarOverflow(TOOLBAR_ITEMS);

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
    const items = OVERFLOW_DEFS.filter((d) => overflowIds.has(d.id));
    // Wire up link action to open the popover
    return items.map((item) => {
      if (item.id === 'link') {
        return { ...item, action: () => setLinkOpen(true) };
      }
      // Colors and table in overflow just use their simple actions
      return item;
    });
  }, [overflowIds]);

  if (!editor) return null;

  const currentLinkUrl = editor.getAttributes('link').href ?? '';

  // Build the visible items to render, based on RENDER_ORDER
  const visibleOrderedIds = RENDER_ORDER.filter((id) => visibleIds.has(id));

  // Get groupId for an item id
  const getGroupId = (id: string) =>
    TOOLBAR_ITEMS.find((i) => i.id === id)?.groupId ?? '';

  // Render an inline toolbar item by id
  const renderItem = (id: string) => {
    switch (id) {
      case 'heading-dropdown':
        return <ToolbarHeadingDropdown editor={editor} />;
      case 'list-dropdown':
        return <ToolbarListDropdown editor={editor} />;
      case 'bold':
        return (
          <ToolbarButton
            icon={<IconBold className="size-4" />}
            tooltip="Bold"
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
        );
      case 'italic':
        return (
          <ToolbarButton
            icon={<IconItalic className="size-4" />}
            tooltip="Italic"
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
        );
      case 'underline':
        return (
          <ToolbarButton
            icon={<IconUnderline className="size-4" />}
            tooltip="Underline"
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
        );
      case 'strikethrough':
        return (
          <ToolbarButton
            icon={<IconStrikethrough className="size-4" />}
            tooltip="Strikethrough"
            isActive={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        );
      case 'link':
        return (
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 rounded-sm',
                  editor.isActive('link') && 'bg-accent text-accent-foreground',
                )}
                type="button"
              >
                <IconLink className="size-4" />
              </Button>
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
                  'size-7 rounded-sm',
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
                  'size-7 rounded-sm',
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
      case 'align-left':
        return (
          <ToolbarButton
            icon={<IconAlignLeft className="size-4" />}
            tooltip="Align Left"
            isActive={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          />
        );
      case 'align-center':
        return (
          <ToolbarButton
            icon={<IconAlignCenter className="size-4" />}
            tooltip="Align Center"
            isActive={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          />
        );
      case 'align-right':
        return (
          <ToolbarButton
            icon={<IconAlignRight className="size-4" />}
            tooltip="Align Right"
            isActive={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          />
        );
      case 'blockquote':
        return (
          <ToolbarButton
            icon={<IconBlockquote className="size-4" />}
            tooltip="Blockquote"
            isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        );
      case 'code-block':
        return (
          <ToolbarButton
            icon={<IconCode className="size-4" />}
            tooltip="Code Block"
            isActive={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
        );
      case 'horizontal-rule':
        return (
          <ToolbarButton
            icon={<IconLine className="size-4" />}
            tooltip="Horizontal Rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        );
      case 'table':
        return <TableInsertPopover editor={editor} />;
      case 'add-prompt':
        return (
          <PromptRefPicker
            editor={editor}
            prompts={prompts}
            collapsed={addPromptCollapsed}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div ref={ref} className="flex flex-1 min-w-0 items-center gap-0.5 overflow-hidden">
      {visibleOrderedIds.map((id, i) => {
        const prevId = visibleOrderedIds[i - 1];
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
