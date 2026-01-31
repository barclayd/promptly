import { ShineText } from '~/components/ui/shine-text';
import { cn } from '~/lib/utils';

const VARIABLE_PATTERN = /(\$\{[^}]+\})/g;

export const HighlightedPromptText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const segments = text.split(VARIABLE_PATTERN);

  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {segments.map((segment, index) => {
        // Use segment + index as key since segments are derived from static text splitting
        const key = `${index}-${segment.slice(0, 10)}`;
        if (VARIABLE_PATTERN.test(segment)) {
          VARIABLE_PATTERN.lastIndex = 0;
          return <ShineText key={key}>{segment}</ShineText>;
        }
        return <span key={key}>{segment}</span>;
      })}
    </span>
  );
};
