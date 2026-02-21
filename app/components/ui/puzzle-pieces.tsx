import type * as React from 'react';

import { cn } from '~/lib/utils';

export type PuzzlePiecesProps = React.HTMLAttributes<HTMLDivElement>;

export const PuzzlePieces = ({ className, ...props }: PuzzlePiecesProps) => {
  return (
    <div className={cn('group relative h-[140px] w-48', className)} {...props}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="puzzle-grid scale-[0.59] transition-[rotate] duration-500 ease-in-out group-hover:rotate-90">
          <div className="puzzle-pc puzzle-tl" />
          <div className="puzzle-pc puzzle-tr" />
          <div className="puzzle-pc puzzle-bl" />
          <div className="puzzle-pc puzzle-br" />
        </div>
      </div>
    </div>
  );
};
