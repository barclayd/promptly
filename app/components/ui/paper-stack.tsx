import type * as React from 'react';
import { cn } from '~/lib/utils';

export type PaperStackProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  content?: string;
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const PaperStack = ({
  className,
  title,
  content,
  ...props
}: PaperStackProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-center h-[188px] w-48',
        className,
      )}
      {...props}
    >
      <div className="paper-stack h-[140px] w-[110px]">
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
            {stripHtml(content)}
          </p>
        )}
      </div>
    </div>
  );
};
