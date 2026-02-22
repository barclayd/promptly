import type * as React from 'react';
import { cn } from '~/lib/utils';
import { containsXml, tokenize } from '~/lib/xml-tokenizer';

export type PaperStackProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  content?: string;
};

const renderContent = (text: string) => {
  if (!containsXml(text)) {
    return <span>{text}</span>;
  }

  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((token, i) => {
        const isXml = token.type === 'tag' || token.type === 'attr-name';
        return isXml ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static token list, never reordered
          <span key={i} className="text-rose-500">
            {token.value}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static token list, never reordered
          <span key={i}>{token.value}</span>
        );
      })}
    </>
  );
};

export const PaperStack = ({
  className,
  title,
  content,
  ...props
}: PaperStackProps) => {
  return (
    <div className={cn('h-[140px] w-[110px]', className)} {...props}>
      <div className="paper-stack h-full w-full">
        {title && (
          <h2
            className="truncate border-b border-gray-200 pb-1 mb-1 font-semibold"
            style={{ fontSize: 'clamp(0.5rem, 1vw, 0.75rem)' }}
          >
            {title}
          </h2>
        )}
        {content && (
          <p className="line-clamp-4 leading-tight text-[0.55rem] text-gray-500 break-words">
            {renderContent(content)}
          </p>
        )}
      </div>
    </div>
  );
};
