import { IconCode } from '@tabler/icons-react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { cn } from '~/lib/utils';

export const CompactVariableRefBadge = ({ node }: ReactNodeViewProps) => {
  const fieldId = node.attrs.fieldId as string;
  const fieldPath = node.attrs.fieldPath as string;

  return (
    <NodeViewWrapper as="span" className="inline mx-0.5">
      <span
        className={cn(
          'inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-medium align-baseline cursor-grab',
          'bg-orange-500/10 text-orange-600 border-orange-500/20',
          'dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
        )}
        contentEditable={false}
        data-drag-handle
      >
        <IconCode className="size-2.5 shrink-0" />
        <span className="truncate max-w-[100px]">{fieldPath || fieldId}</span>
      </span>
    </NodeViewWrapper>
  );
};
