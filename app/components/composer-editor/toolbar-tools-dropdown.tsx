'use client';

import {
  IconBlockquote,
  IconBrandHtml5,
  IconChevronDown,
  IconCode,
  IconLine,
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

const TOOLS = [
  {
    id: 'blockquote' as const,
    label: 'Blockquote',
    Icon: IconBlockquote,
    isActive: (editor: Editor) => editor.isActive('blockquote'),
    action: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code-block' as const,
    label: 'Code Block',
    Icon: IconCode,
    isActive: (editor: Editor) => editor.isActive('codeBlock'),
    action: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'horizontal-rule' as const,
    label: 'Horizontal Rule',
    Icon: IconLine,
    isActive: () => false,
    action: (editor: Editor) =>
      editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'html-block' as const,
    label: 'HTML Block',
    Icon: IconBrandHtml5,
    isActive: (editor: Editor) => editor.isActive('htmlBlock'),
    action: (editor: Editor) => editor.chain().focus().insertHtmlBlock().run(),
  },
];

type ToolbarToolsDropdownProps = {
  editor: Editor;
};

export const ToolbarToolsDropdown = ({ editor }: ToolbarToolsDropdownProps) => {
  const activeTool = TOOLS.find((t) => t.isActive(editor));
  const TriggerIcon = activeTool?.Icon ?? IconBlockquote;
  const isActive = !!activeTool;

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
          Blocks
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {TOOLS.map(({ id, label, Icon, isActive: checkActive, action }) => (
          <DropdownMenuItem
            key={id}
            className={cn('gap-2', checkActive(editor) && 'bg-accent')}
            onSelect={() => action(editor)}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
