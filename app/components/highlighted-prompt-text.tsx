import { ShineText } from '~/components/ui/shine-text';
import { cn } from '~/lib/utils';
import { containsXml, type Token, tokenize } from '~/lib/xml-tokenizer';

const VARIABLE_PATTERN = /(\$\{[^}]+\})/g;

const XML_TOKEN_STYLES: Partial<Record<Token['type'], string>> = {
  tag: 'text-rose-700/80 dark:text-rose-400/70',
  'attr-name': 'text-rose-700/80 dark:text-rose-400/70',
};

export const HighlightedPromptText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  if (!containsXml(text)) {
    // Existing variable-only split — zero regression risk
    const segments = text.split(VARIABLE_PATTERN);
    return (
      <span className={cn('whitespace-pre-wrap break-words', className)}>
        {segments.map((segment, index) => {
          const key = `${index}-${segment.slice(0, 10)}`;
          if (VARIABLE_PATTERN.test(segment)) {
            VARIABLE_PATTERN.lastIndex = 0;
            return <ShineText key={key}>{segment}</ShineText>;
          }
          return <span key={key}>{segment}</span>;
        })}
      </span>
    );
  }

  // XML path — tokenize and render with colors
  const tokens = tokenize(text);
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {tokens.map((token, index) => {
        const key = `${index}-${token.type}-${token.value.slice(0, 10)}`;
        if (token.type === 'variable') {
          return <ShineText key={key}>{token.value}</ShineText>;
        }
        const style = XML_TOKEN_STYLES[token.type];
        if (style) {
          return (
            <span key={key} className={style}>
              {token.value}
            </span>
          );
        }
        return <span key={key}>{token.value}</span>;
      })}
    </span>
  );
};
