'use client';

import type * as React from 'react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

export type FolderProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Whether the folder starts in the open state */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
};

export const Folder = ({
  className,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  ...props
}: FolderProps) => {
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

  // Dimensions: tab is 48px (h-12), overlaps main body by 36px, extends 12px above
  // Total height: 128px (main body) + 12px (tab extension) = 140px
  // Tab width: 2/5 of 192px = ~77px

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Visual folder animation, not interactive control
    <div
      className={cn(
        'relative h-[140px] w-48',
        'transition-all duration-300 ease-in-out',
        className,
      )}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      {...props}
    >
      {/* Folder Back - the base layer spanning tab + body area */}
      <div
        className={cn(
          'absolute bottom-0 left-0',
          'h-32 w-full',
          'rounded-lg bg-blue-600 shadow-lg',
        )}
      />

      {/* Folder Tab - connects visually with the back */}
      <div
        className={cn(
          'absolute left-0 top-0',
          'h-12 w-2/5',
          'rounded-t-lg bg-blue-600',
        )}
      />

      {/* File 1 (back file) - positioned relative to main body area */}
      <div
        className={cn(
          'absolute left-2 bottom-[40px]',
          'h-[62px] w-5/6',
          'rounded-t-lg bg-blue-200 shadow-lg',
          'transition-all duration-300 ease-in-out',
          'origin-bottom-left',
          isOpen ? '-rotate-[7deg]' : 'rotate-0',
        )}
      />

      {/* File 2 (front file) */}
      <div
        className={cn(
          'absolute left-3 bottom-[69px]',
          'h-[51px] w-5/6',
          'rounded-t-lg bg-white shadow-lg',
          'transition-all duration-300 ease-in-out',
          'origin-bottom-left',
          isOpen ? '-rotate-[2deg]' : 'rotate-0',
        )}
      />

      {/* Folder Body - the front flap */}
      <div
        className={cn(
          'absolute bottom-0 left-0',
          'w-full rounded-lg bg-blue-400 shadow-lg',
          'transition-all duration-300 ease-in-out',
          isOpen ? 'h-[77px]' : 'h-[102px]',
        )}
      />
    </div>
  );
};
