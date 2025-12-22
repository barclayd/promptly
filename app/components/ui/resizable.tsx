'use client';

import { GripVertical } from 'lucide-react';
import {
  Group,
  type LayoutStorage,
  Panel,
  Separator,
  useDefaultLayout,
} from 'react-resizable-panels';

import { cn } from '~/lib/utils';

export { useDefaultLayout, type LayoutStorage };

export const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group
    className={cn(
      'flex h-full w-full data-[orientation=vertical]:flex-col',
      className,
    )}
    {...props}
  />
);

export const ResizablePanel = Panel;

export const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      'group/handle relative flex w-px items-center justify-center',
      // Base styling - subtle border that matches sidebar
      'bg-sidebar-border',
      // Expanded hit area for easier grabbing
      'after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2',
      // Hover state - subtle glow effect
      'hover:bg-sidebar-primary/50 transition-colors duration-150',
      // Focus state
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1',
      // Active/dragging state
      'data-[resize-handle-active]:bg-sidebar-primary',
      // Vertical orientation support
      'data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full',
      'data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full',
      'data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0',
      '[&[data-orientation=vertical]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div
        className={cn(
          'z-10 flex h-6 w-3.5 items-center justify-center rounded-sm',
          // Subtle background that blends with sidebar
          'bg-sidebar border border-sidebar-border',
          // Hover enhancement
          'group-hover/handle:border-sidebar-primary/50 group-hover/handle:bg-sidebar-accent',
          // Active state
          'group-data-[resize-handle-active]/handle:border-sidebar-primary group-data-[resize-handle-active]/handle:bg-sidebar-accent',
          // Smooth transitions
          'transition-all duration-150',
        )}
      >
        <GripVertical
          className={cn(
            'h-3 w-3 text-sidebar-foreground/40',
            'group-hover/handle:text-sidebar-foreground/70',
            'group-data-[resize-handle-active]/handle:text-sidebar-primary',
            'transition-colors duration-150',
          )}
        />
      </div>
    )}
  </Separator>
);
