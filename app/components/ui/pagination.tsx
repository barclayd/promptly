import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
} from '@tabler/icons-react';
import type * as React from 'react';

import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';

export const Pagination = ({
  className,
  ...props
}: React.ComponentProps<'nav'>) => (
  <nav
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);

export const PaginationContent = ({
  className,
  ...props
}: React.ComponentProps<'ul'>) => (
  <ul
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
);

export const PaginationItem = ({
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li className={cn('', className)} {...props} />
);

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<'button'>;

export const PaginationLink = ({
  className,
  isActive,
  children,
  ...props
}: PaginationLinkProps) => (
  <button
    type="button"
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size: 'icon-sm',
      }),
      'size-7 text-xs',
      isActive && 'pointer-events-none',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<'button'>) => (
  <button
    type="button"
    aria-label="Go to previous page"
    className={cn(
      buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
      'size-7',
      className,
    )}
    {...props}
  >
    <IconChevronLeft className="size-4" />
  </button>
);

export const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<'button'>) => (
  <button
    type="button"
    aria-label="Go to next page"
    className={cn(
      buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
      'size-7',
      className,
    )}
    {...props}
  >
    <IconChevronRight className="size-4" />
  </button>
);

export const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn(
      'flex size-7 items-center justify-center text-muted-foreground',
      className,
    )}
    {...props}
  >
    <IconDots className="size-4" />
    <span className="sr-only">More pages</span>
  </span>
);
