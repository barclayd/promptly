'use client';

import { useCallback, useRef } from 'react';
import { cn } from '~/lib/utils';

type VersionInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
};

const focusAtEnd = (node: HTMLInputElement | null) => {
  if (node) {
    node.focus();
    const len = node.value.length;
    node.setSelectionRange(len, len);
  }
};

export const VersionInput = ({
  value,
  onChange,
  disabled,
  className,
  autoFocus,
}: VersionInputProps) => {
  const parts = value.split('.');
  const major = parts[0] ?? '';
  const minor = parts[1] ?? '';
  const patch = parts[2] ?? '';

  const majorRef = useRef<HTMLInputElement>(null);
  const minorRef = useRef<HTMLInputElement>(null);
  const patchRef = useRef<HTMLInputElement>(null);

  const majorRefCallback = (node: HTMLInputElement | null) => {
    majorRef.current = node;
    if (autoFocus) {
      focusAtEnd(node);
    }
  };

  const handleChange = useCallback(
    (segment: 'major' | 'minor' | 'patch', newValue: string) => {
      const numericValue = newValue.replace(/\D/g, '').slice(0, 3);

      let newMajor = major;
      let newMinor = minor;
      let newPatch = patch;

      if (segment === 'major') {
        newMajor = numericValue;
      } else if (segment === 'minor') {
        newMinor = numericValue;
      } else {
        newPatch = numericValue;
      }

      onChange(`${newMajor}.${newMinor}.${newPatch}`);
    },
    [major, minor, patch, onChange],
  );

  const handleKeyDown = useCallback(
    (
      segment: 'major' | 'minor' | 'patch',
      e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      const target = e.currentTarget;

      if (e.key === 'ArrowRight') {
        if (target.selectionStart === target.value.length) {
          e.preventDefault();
          if (segment === 'major') minorRef.current?.focus();
          if (segment === 'minor') patchRef.current?.focus();
        }
      }

      if (e.key === 'ArrowLeft') {
        if (target.selectionStart === 0) {
          e.preventDefault();
          if (segment === 'minor') majorRef.current?.focus();
          if (segment === 'patch') minorRef.current?.focus();
        }
      }

      if (e.key === 'Backspace' && target.value === '') {
        e.preventDefault();
        if (segment === 'minor') majorRef.current?.focus();
        if (segment === 'patch') minorRef.current?.focus();
      }

      if (e.key === '.') {
        e.preventDefault();
        if (segment === 'major') minorRef.current?.focus();
        if (segment === 'minor') patchRef.current?.focus();
      }
    },
    [],
  );

  const segmentClasses = cn(
    'w-12 h-10 text-center text-base font-mono rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  );

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <input
        ref={majorRefCallback}
        type="text"
        inputMode="numeric"
        value={major}
        onChange={(e) => handleChange('major', e.target.value)}
        onKeyDown={(e) => handleKeyDown('major', e)}
        disabled={disabled}
        className={segmentClasses}
        aria-label="Major version"
        tabIndex={0}
      />
      <span className="text-muted-foreground font-mono text-lg">.</span>
      <input
        ref={minorRef}
        type="text"
        inputMode="numeric"
        value={minor}
        onChange={(e) => handleChange('minor', e.target.value)}
        onKeyDown={(e) => handleKeyDown('minor', e)}
        disabled={disabled}
        className={segmentClasses}
        aria-label="Minor version"
        tabIndex={0}
      />
      <span className="text-muted-foreground font-mono text-lg">.</span>
      <input
        ref={patchRef}
        type="text"
        inputMode="numeric"
        value={patch}
        onChange={(e) => handleChange('patch', e.target.value)}
        onKeyDown={(e) => handleKeyDown('patch', e)}
        disabled={disabled}
        className={segmentClasses}
        aria-label="Patch version"
        tabIndex={0}
      />
    </div>
  );
};
