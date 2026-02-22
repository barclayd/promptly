'use client';

import {
  IconChevronDown,
  IconList,
  IconListCheck,
  IconListNumbers,
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

const LISTS = [
  {
    type: 'bulletList' as const,
    label: 'Bullet List',
    Icon: IconList,
    toggle: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    type: 'orderedList' as const,
    label: 'Ordered List',
    Icon: IconListNumbers,
    toggle: (editor: Editor) =>
      editor.chain().focus().toggleOrderedList().run(),
  },
  {
    type: 'taskList' as const,
    label: 'Task List',
    Icon: IconListCheck,
    toggle: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
];

type ToolbarListDropdownProps = {
  editor: Editor;
};

export const ToolbarListDropdown = ({ editor }: ToolbarListDropdownProps) => {
  const activeList = LISTS.find((l) => editor.isActive(l.type));
  const TriggerIcon = activeList?.Icon ?? IconList;
  const isActive = !!activeList;

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
          List
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {LISTS.map(({ type, label, Icon, toggle }) => (
          <DropdownMenuItem
            key={type}
            className={cn('gap-2', editor.isActive(type) && 'bg-accent')}
            onSelect={() => toggle(editor)}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
