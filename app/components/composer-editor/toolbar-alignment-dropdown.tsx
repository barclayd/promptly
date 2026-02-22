'use client';

import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconChevronDown,
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

const ALIGNMENTS = [
  {
    value: 'left' as const,
    label: 'Align Left',
    Icon: IconAlignLeft,
  },
  {
    value: 'center' as const,
    label: 'Align Center',
    Icon: IconAlignCenter,
  },
  {
    value: 'right' as const,
    label: 'Align Right',
    Icon: IconAlignRight,
  },
];

type ToolbarAlignmentDropdownProps = {
  editor: Editor;
};

export const ToolbarAlignmentDropdown = ({
  editor,
}: ToolbarAlignmentDropdownProps) => {
  const activeAlignment = ALIGNMENTS.find((a) =>
    editor.isActive({ textAlign: a.value }),
  );
  const TriggerIcon = activeAlignment?.Icon ?? IconAlignLeft;
  // "left" is the default — only show active state for center/right
  const isActive = !!activeAlignment && activeAlignment.value !== 'left';

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
          Alignment
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {ALIGNMENTS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            className={cn(
              'gap-2',
              editor.isActive({ textAlign: value }) && 'bg-accent',
            )}
            onSelect={() => editor.chain().focus().setTextAlign(value).run()}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
