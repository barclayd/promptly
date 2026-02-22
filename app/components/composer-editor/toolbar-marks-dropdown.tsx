'use client';

import {
  IconBold,
  IconChevronDown,
  IconItalic,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

const MARKS = [
  {
    id: 'bold' as const,
    label: 'Bold',
    Icon: IconBold,
    shortcut: '⌘B',
    isActive: (e: Editor) => e.isActive('bold'),
    action: (e: Editor) => e.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic' as const,
    label: 'Italic',
    Icon: IconItalic,
    shortcut: '⌘I',
    isActive: (e: Editor) => e.isActive('italic'),
    action: (e: Editor) => e.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline' as const,
    label: 'Underline',
    Icon: IconUnderline,
    shortcut: '⌘U',
    isActive: (e: Editor) => e.isActive('underline'),
    action: (e: Editor) => e.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'strikethrough' as const,
    label: 'Strikethrough',
    Icon: IconStrikethrough,
    shortcut: '⌘⇧S',
    isActive: (e: Editor) => e.isActive('strike'),
    action: (e: Editor) => e.chain().focus().toggleStrike().run(),
  },
];

type ToolbarMarksDropdownProps = {
  editor: Editor;
};

export const ToolbarMarksDropdown = ({ editor }: ToolbarMarksDropdownProps) => {
  const activeMark = MARKS.find((m) => m.isActive(editor));
  const TriggerIcon = activeMark?.Icon ?? IconBold;
  const isActive = !!activeMark;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'h-7 gap-0.5 rounded-sm px-1.5 focus-visible:ring-0',
                isActive && 'bg-accent text-accent-foreground',
              )}
              type="button"
            >
              <TriggerIcon className="size-4" />
              <IconChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Text formatting
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[170px]">
        {MARKS.map(
          ({ id, label, Icon, shortcut, isActive: checkActive, action }) => (
            <DropdownMenuItem
              key={id}
              className={cn('gap-2', checkActive(editor) && 'bg-accent')}
              onSelect={() => action(editor)}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-muted-foreground">{shortcut}</span>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
