'use client';

import {
  IconChevronDown,
  IconH1,
  IconH2,
  IconH3,
  IconHeading,
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

const HEADINGS = [
  { level: 1 as const, label: 'Heading 1', Icon: IconH1 },
  { level: 2 as const, label: 'Heading 2', Icon: IconH2 },
  { level: 3 as const, label: 'Heading 3', Icon: IconH3 },
];

type ToolbarHeadingDropdownProps = {
  editor: Editor;
};

export const ToolbarHeadingDropdown = ({
  editor,
}: ToolbarHeadingDropdownProps) => {
  const activeHeading = HEADINGS.find((h) =>
    editor.isActive('heading', { level: h.level }),
  );
  const TriggerIcon = activeHeading?.Icon ?? IconHeading;
  const isActive = !!activeHeading;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'h-7 gap-0.5 rounded-sm px-1.5',
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
          Heading
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {HEADINGS.map(({ level, label, Icon }) => (
          <DropdownMenuItem
            key={level}
            className={cn(
              'gap-2',
              editor.isActive('heading', { level }) && 'bg-accent',
            )}
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
