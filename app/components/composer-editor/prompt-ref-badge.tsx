import { IconFileText } from '@tabler/icons-react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { cn } from '~/lib/utils';

export const PromptRefBadge = ({ node, selected }: ReactNodeViewProps) => {
  const promptId = node.attrs.promptId as string;
  const promptName = node.attrs.promptName as string;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium align-baseline cursor-default',
          'bg-primary/10 text-primary border-primary/20',
          'dark:bg-primary/15 dark:border-primary/30',
          selected && 'ring-2 ring-primary/40 ring-offset-1',
        )}
        contentEditable={false}
      >
        <IconFileText className="size-3 shrink-0" />
        <span className="truncate max-w-[150px]">{promptName || promptId}</span>
      </span>
    </NodeViewWrapper>
  );
};
