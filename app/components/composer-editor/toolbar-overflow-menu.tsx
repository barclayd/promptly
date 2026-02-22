'use client';

import { IconChevronRight } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { Fragment } from 'react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import type { OverflowItemDef } from './composer-toolbar';

type ToolbarOverflowMenuProps = {
  editor: Editor;
  items: OverflowItemDef[];
};

export const ToolbarOverflowMenu = ({
  editor,
  items,
}: ToolbarOverflowMenuProps) => {
  if (items.length === 0) return null;

  // Group items by groupId, preserving order
  const groups: Array<{
    groupId: string;
    groupLabel: string;
    items: OverflowItemDef[];
  }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.groupId === item.groupId) {
      last.items.push(item);
    } else {
      groups.push({
        groupId: item.groupId,
        groupLabel: item.groupLabel,
        items: [item],
      });
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-sm focus-visible:ring-0"
              type="button"
            >
              <IconChevronRight className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          More options
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {groups.map((group, gi) => (
          <Fragment key={group.groupId}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.groupLabel}
              </DropdownMenuLabel>
              {group.items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className={cn(
                    'gap-2',
                    item.isActive?.(editor) && 'bg-accent',
                  )}
                  onSelect={() => item.action(editor)}
                >
                  <item.Icon className="size-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
