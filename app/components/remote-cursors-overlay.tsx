import { useCallback, useEffect, useRef, useState } from 'react';
import { CursorIndicator } from '~/components/cursor-indicator';
import type { CursorPosition } from '~/hooks/use-presence';
import { getUserColor } from '~/lib/user-colors';

type RemoteCursorsOverlayProps = {
  cursors: CursorPosition[];
  textareaRef: HTMLTextAreaElement | null;
  field: 'systemMessage' | 'userMessage';
};

type CalculatedCursor = {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  lineHeight: number;
};

// Create a hidden mirror element to calculate cursor position
const calculateCursorPosition = (
  textarea: HTMLTextAreaElement,
  position: number,
): { x: number; y: number; lineHeight: number } | null => {
  // Get computed styles from the textarea
  const styles = window.getComputedStyle(textarea);

  // Use the LOCAL textarea width to calculate where the character position
  // would appear on THIS user's screen. This ensures the remote cursor appears
  // at the correct character position regardless of different viewport widths.
  const mirrorWidth = textarea.clientWidth;

  // Create a mirror div that matches the textarea styling
  const mirror = document.createElement('div');
  mirror.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    width: ${mirrorWidth}px;
    font-family: ${styles.fontFamily};
    font-size: ${styles.fontSize};
    font-weight: ${styles.fontWeight};
    line-height: ${styles.lineHeight};
    letter-spacing: ${styles.letterSpacing};
    padding: ${styles.padding};
    border: ${styles.border};
    box-sizing: border-box;
  `;

  const text = textarea.value;
  const textBeforeCursor = text.slice(0, position);

  // Create a span to mark the cursor position
  const textNode = document.createTextNode(textBeforeCursor);
  const cursorMarker = document.createElement('span');
  cursorMarker.textContent = '\u200B'; // Zero-width space

  mirror.appendChild(textNode);
  mirror.appendChild(cursorMarker);

  document.body.appendChild(mirror);

  const markerRect = cursorMarker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Calculate position relative to the textarea
  const x = markerRect.left - mirrorRect.left;
  const y = markerRect.top - mirrorRect.top - textarea.scrollTop;

  // Get line height
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20;

  document.body.removeChild(mirror);

  // Check if cursor is within visible bounds
  if (y < 0 || y > textarea.clientHeight) {
    return null; // Cursor is scrolled out of view
  }

  return { x, y, lineHeight };
};

export const RemoteCursorsOverlay = ({
  cursors,
  textareaRef,
  field,
}: RemoteCursorsOverlayProps) => {
  const [calculatedCursors, setCalculatedCursors] = useState<
    CalculatedCursor[]
  >([]);
  const rafRef = useRef<number | null>(null);

  // Filter cursors for this field and calculate positions
  const updateCursorPositions = useCallback(() => {
    if (!textareaRef) return;

    const fieldCursors = cursors.filter(
      (c) => c.field === field && c.isActive !== false,
    );
    const calculated: CalculatedCursor[] = [];

    for (const cursor of fieldCursors) {
      const pos = calculateCursorPosition(textareaRef, cursor.position);
      if (pos) {
        calculated.push({
          userId: cursor.userId,
          userName: cursor.userName,
          color: getUserColor(cursor.userId),
          x: pos.x,
          y: pos.y,
          lineHeight: pos.lineHeight,
        });
      }
    }

    setCalculatedCursors(calculated);
  }, [cursors, textareaRef, field]);

  // Recalculate when cursors or textarea changes
  // Use requestAnimationFrame for smooth updates
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(updateCursorPositions);
  }, [updateCursorPositions]);

  // Trigger update when cursors change
  useEffect(() => {
    if (textareaRef && cursors.length > 0) {
      scheduleUpdate();
    }
  }, [cursors, textareaRef, scheduleUpdate]);

  if (calculatedCursors.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {calculatedCursors.map((cursor) => (
        <CursorIndicator
          key={cursor.userId}
          userName={cursor.userName}
          color={cursor.color}
          x={cursor.x}
          y={cursor.y}
          lineHeight={cursor.lineHeight}
        />
      ))}
    </div>
  );
};
