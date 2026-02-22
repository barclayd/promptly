'use client';

import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTable,
  IconTableOff,
  IconTablePlus,
} from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
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

type TableInsertPopoverProps = {
  editor: Editor;
};

export const TableInsertPopover = ({ editor }: TableInsertPopoverProps) => {
  const [rows, setRows] = useState('3');
  const [cols, setCols] = useState('3');
  const isInTable = editor.isActive('table');

  const handleInsertTable = () => {
    const r = Number.parseInt(rows, 10) || 3;
    const c = Number.parseInt(cols, 10) || 3;
    editor
      .chain()
      .focus()
      .insertTable({ rows: r, cols: c, withHeaderRow: true })
      .run();
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'size-7 rounded-sm',
                isInTable && 'bg-accent text-accent-foreground',
              )}
              type="button"
            >
              <IconTable className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Table
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-52 p-3" side="bottom" align="start">
        {isInTable ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Edit Table
            </p>
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                type="button"
              >
                <IconRowInsertTop className="size-3.5" />
                Row above
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                type="button"
              >
                <IconRowInsertBottom className="size-3.5" />
                Row below
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                type="button"
              >
                <IconColumnInsertLeft className="size-3.5" />
                Col left
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                type="button"
              >
                <IconColumnInsertRight className="size-3.5" />
                Col right
              </Button>
            </div>
            <Separator className="my-1" />
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5 text-destructive hover:text-destructive"
                onClick={() => editor.chain().focus().deleteRow().run()}
                type="button"
              >
                <IconRowRemove className="size-3.5" />
                Delete row
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start gap-1.5 text-destructive hover:text-destructive"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                type="button"
              >
                <IconColumnRemove className="size-3.5" />
                Delete col
              </Button>
            </div>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs justify-start gap-1.5 text-destructive hover:text-destructive"
              onClick={() => editor.chain().focus().deleteTable().run()}
              type="button"
            >
              <IconTableOff className="size-3.5" />
              Delete table
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Insert Table
            </p>
            <div className="flex gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  className="h-7 text-xs w-16"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Cols</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={cols}
                  onChange={(e) => setCols(e.target.value)}
                  className="h-7 text-xs w-16"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleInsertTable}
              type="button"
            >
              <IconTablePlus className="size-3.5" />
              Insert
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
