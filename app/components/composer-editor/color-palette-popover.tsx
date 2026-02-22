'use client';

import { IconX } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Brown', value: '#92400e' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Indigo', value: '#4f46e5' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Red', value: '#fecaca' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Teal', value: '#99f6e4' },
  { name: 'Gray', value: '#e5e7eb' },
  { name: 'Indigo', value: '#c7d2fe' },
  { name: 'Amber', value: '#fde68a' },
];

type ColorPalettePopoverProps = {
  type: 'text' | 'highlight';
  editor: Editor;
  trigger: React.ReactNode;
};

export const ColorPalettePopover = ({
  type,
  editor,
  trigger,
}: ColorPalettePopoverProps) => {
  const colors = type === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const label = type === 'text' ? 'Text Color' : 'Highlight Color';

  const handleSelectColor = (color: string) => {
    if (type === 'text') {
      if (color === '') {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    } else {
      if (color === '') {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().toggleHighlight({ color }).run();
      }
    }
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto p-3" side="bottom" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {label}
        </p>
        <div className="grid grid-cols-6 gap-1">
          {colors.map((color) =>
            color.value === '' ? (
              <Tooltip key="remove">
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 rounded-sm"
                    onClick={() => handleSelectColor('')}
                    type="button"
                  >
                    <IconX className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Remove</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip key={color.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'size-6 rounded-sm border border-border/50 transition-transform hover:scale-110 cursor-pointer',
                      type === 'text' && 'ring-1 ring-inset ring-white/20',
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleSelectColor(color.value)}
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {color.name}
                </TooltipContent>
              </Tooltip>
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
