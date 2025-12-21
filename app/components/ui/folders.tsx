'use client';

import { useState } from 'react';
import type * as React from 'react';

import { cn } from '~/lib/utils';

interface FoldersProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the folder starts in the open state */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

function Folders({
  className,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  ...props
}: FoldersProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpen = () => {
    if (!isControlled) {
      setInternalOpen(true);
    }
    onOpenChange?.(true);
  };

  const handleClose = () => {
    if (!isControlled) {
      setInternalOpen(false);
    }
    onOpenChange?.(false);
  };

  return (
    <div
      aria-label="Folder"
      className={cn(
        'relative h-32 w-48',
        'transform -translate-x-4',
        'transition-all duration-300 ease-in-out',
        className
      )}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      {...props}
    >
      {/* Folder Tab */}
      <div
        className={cn(
          'absolute left-0 top-0',
          'h-12 w-2/5',
          'rounded-t-lg bg-blue-600',
          '-translate-y-3 translate-x-0'
        )}
      />

      {/* File 1 (back file) */}
      <div
        className={cn(
          'absolute left-2 top-6',
          'h-2/5 w-5/6',
          'rounded-t-lg bg-blue-100 shadow-lg',
          '-translate-y-3 translate-x-0',
          'transition-all duration-300 ease-in-out',
          'origin-bottom-left',
          isOpen ? '-rotate-[7deg]' : 'rotate-0'
        )}
      />

      {/* File 2 (front file) */}
      <div
        className={cn(
          'absolute left-5 top-11',
          'h-2/5 w-5/6',
          'rounded-t-lg bg-blue-200 shadow-lg',
          '-translate-y-3 translate-x-0',
          'transition-all duration-300 ease-in-out',
          'origin-bottom-left',
          isOpen ? '-rotate-[2deg]' : 'rotate-0'
        )}
      />

      {/* Folder Body */}
      <div
        className={cn(
          'absolute bottom-0 left-0',
          'w-full rounded-lg bg-blue-400 shadow-lg',
          'transition-all duration-300 ease-in-out',
          isOpen ? 'h-3/5' : 'h-4/5'
        )}
      />

      {/* Folder Back (creates depth) */}
      <div
        className={cn(
          'absolute left-0 top-0',
          'h-full w-full',
          'rounded-lg bg-blue-600 shadow-lg',
          '-z-10'
        )}
      />
    </div>
  );
}

export { Folders };
export type { FoldersProps };
