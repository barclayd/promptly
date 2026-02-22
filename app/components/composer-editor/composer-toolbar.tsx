'use client';

import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBlockquote,
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconHighlight,
  IconItalic,
  IconLetterCase,
  IconLine,
  IconLink,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconUnderline,
} from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { useCallback, useState } from 'react';
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
import { cn } from '~/lib/utils';
import { ColorPalettePopover } from './color-palette-popover';
import { LinkEditPopover } from './link-edit-popover';
import { PromptRefPicker } from './prompt-ref-picker';
import { TableInsertPopover } from './table-insert-popover';

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

type ComposerToolbarProps = {
  editor: Editor | null;
  prompts?: Array<{ id: string; name: string }>;
};

export const ComposerToolbar = ({ editor, prompts }: ComposerToolbarProps) => {
  const [linkOpen, setLinkOpen] = useState(false);

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

  if (!editor) return null;

  const currentLinkUrl = editor.getAttributes('link').href ?? '';

  return (
    <div className="flex items-center flex-wrap gap-0.5">
      {/* Text marks */}
      <ToolbarButton
        icon={<IconBold className="size-4" />}
        tooltip="Bold"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<IconItalic className="size-4" />}
        tooltip="Italic"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<IconUnderline className="size-4" />}
        tooltip="Underline"
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={<IconStrikethrough className="size-4" />}
        tooltip="Strikethrough"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <ToolbarSeparator />

      {/* Headings */}
      <ToolbarButton
        icon={<IconH1 className="size-4" />}
        tooltip="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<IconH2 className="size-4" />}
        tooltip="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<IconH3 className="size-4" />}
        tooltip="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton
        icon={<IconList className="size-4" />}
        tooltip="Bullet List"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<IconListNumbers className="size-4" />}
        tooltip="Ordered List"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<IconListCheck className="size-4" />}
        tooltip="Task List"
        isActive={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <ToolbarSeparator />

      {/* Block elements */}
      <ToolbarButton
        icon={<IconBlockquote className="size-4" />}
        tooltip="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={<IconCode className="size-4" />}
        tooltip="Code Block"
        isActive={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        icon={<IconLine className="size-4" />}
        tooltip="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <ToolbarSeparator />

      {/* Colors */}
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

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarButton
        icon={<IconAlignLeft className="size-4" />}
        tooltip="Align Left"
        isActive={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      />
      <ToolbarButton
        icon={<IconAlignCenter className="size-4" />}
        tooltip="Align Center"
        isActive={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      />
      <ToolbarButton
        icon={<IconAlignRight className="size-4" />}
        tooltip="Align Right"
        isActive={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      />

      <ToolbarSeparator />

      {/* Sub/Superscript */}
      <ToolbarButton
        icon={<IconSubscript className="size-4" />}
        tooltip="Subscript"
        isActive={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      />
      <ToolbarButton
        icon={<IconSuperscript className="size-4" />}
        tooltip="Superscript"
        isActive={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      />

      <ToolbarSeparator />

      {/* Table */}
      <TableInsertPopover editor={editor} />

      {/* Link */}
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

      <ToolbarSeparator />

      {/* Prompt Ref */}
      <PromptRefPicker editor={editor} prompts={prompts} />
    </div>
  );
};
