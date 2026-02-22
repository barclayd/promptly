import { IconCode } from '@tabler/icons-react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { cn } from '~/lib/utils';

export const VariableRefBadge = ({ node, selected }: ReactNodeViewProps) => {
  const fieldId = node.attrs.fieldId as string;
  const fieldPath = node.attrs.fieldPath as string;

  return (
    <NodeViewWrapper as="span" className="inline mx-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium align-baseline cursor-grab',
          'bg-blue-500/10 text-blue-600 border-blue-500/20',
          'dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
          selected && 'ring-2 ring-blue-500/40 ring-offset-1',
        )}
        contentEditable={false}
        data-drag-handle
      >
        <IconCode className="size-3 shrink-0" />
        <span className="truncate max-w-[150px]">{fieldPath || fieldId}</span>
      </span>
    </NodeViewWrapper>
  );
};
