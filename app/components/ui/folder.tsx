import type * as React from 'react';

import { cn } from '~/lib/utils';

// SVG noise filter for texture effects - rendered once and referenced by ID
function NoiseFilter() {
  return (
    <svg
      className="absolute block h-0 w-0 overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <filter id="folder-noise">
        <feTurbulence baseFrequency="0.195" />
        <feColorMatrix
          values="0 0 0 9 -5
                  0 0 0 9 -4
                  0 0 0 9 -5
                  0 0 0 0 1"
        />
      </filter>
    </svg>
  );
}

// Dots overlay for texture
function Dots({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'folder-noise-dots pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-screen',
        className,
      )}
    />
  );
}

// Scratches overlay for texture
function Scratches({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none', className)}>
      <div className="folder-noise-scratch-1 absolute inset-0 rounded-[inherit] mix-blend-screen" />
      <div className="folder-noise-scratch-2 absolute inset-0 rounded-[inherit] mix-blend-screen" />
    </div>
  );
}

// Document placeholder rows
function DocPlaceholder({
  isLast,
  isLastRow,
}: {
  isLast?: boolean;
  isLastRow?: boolean;
}) {
  return (
    <div
      className={cn(
        'folder-placeholder',
        isLastRow ? 'w-[40%]' : isLast ? 'w-[66%]' : 'w-full',
      )}
    />
  );
}

function DocRow({ children }: { children: React.ReactNode }) {
  return <div className="folder-doc-row flex flex-col">{children}</div>;
}

// Internal document with stacked paper effect
function Doc({ className }: { className?: string }) {
  return (
    <div className={cn('folder-doc absolute flex flex-col', className)}>
      {/* Paper behind - right rotation */}
      <div className="folder-doc-paper-right absolute rounded-[inherit]" />
      {/* Paper behind - left rotation */}
      <div className="folder-doc-paper-left absolute rounded-[inherit]" />
      <DocRow>
        <DocPlaceholder />
        <DocPlaceholder isLast />
      </DocRow>
      <DocRow>
        <DocPlaceholder isLastRow />
      </DocRow>
    </div>
  );
}

// Foreground folder flap with tab
function FolderForeground() {
  return (
    <div className="absolute inset-0">
      <div className="folder-fg-wrapper absolute left-0 right-0">
        {/* Main foreground panel */}
        <div className="folder-fg-panel absolute inset-0 rounded-[inherit]" />

        {/* Tab - main section */}
        <div className="folder-tab-main absolute inset-0 backdrop-blur-sm" />

        {/* Tab - middle connector */}
        <div className="folder-tab-middle absolute backdrop-blur-sm" />

        {/* Tab - curved end piece */}
        <div className="folder-tab-end absolute backdrop-blur-sm" />

        <Dots />
        <Scratches />
      </div>
    </div>
  );
}

interface FolderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary color for the folder (default: #0e91eb) */
  primaryColor?: string;
  /** Secondary/background color for the folder (default: #0a78eb) */
  secondaryColor?: string;
  /** Size of the folder in vmin (default: 50) */
  size?: number;
}

function Folder({
  className,
  primaryColor = '#0e91eb',
  secondaryColor = '#0a78eb',
  size = 50,
  ...props
}: FolderProps) {
  return (
    <>
      <NoiseFilter />
      <div
        aria-label="Animated Folder Icon"
        className={cn(
          'folder-root group relative cursor-pointer overflow-hidden',
          className,
        )}
        style={
          {
            '--folder-primary': primaryColor,
            '--folder-secondary': secondaryColor,
            width: `${size}vmin`,
          } as React.CSSProperties
        }
        {...props}
      >
        {/* Flower badge */}
        <span
          className="folder-badge absolute z-[1111] backdrop-blur-[0.2rem]"
          aria-hidden="true"
        >
          ✿
        </span>

        <Dots />
        <Scratches />

        {/* Document container with mask */}
        <div className="folder-doc-container absolute inset-0">
          <Doc />
        </div>

        <FolderForeground />
      </div>
    </>
  );
}

export { Folder };
