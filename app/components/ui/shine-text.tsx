import type * as React from 'react';
import { cn } from '~/lib/utils';

export const ShineText = ({
  className,
  children,
  ...props
}: React.ComponentProps<'span'>) => {
  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-shine',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
