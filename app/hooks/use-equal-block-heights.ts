import { useCallback, useRef } from 'react';

const BLOCK_TYPES = ['system', 'user', 'output'] as const;

/** Minimum visible height of a section's scroll viewport (~4 lines of text). */
const MIN_VIEWPORT_PX = 104;

/**
 * Aligns the sections of sibling cards so their content lines up row-by-row.
 *
 * Each block carries `data-cv-block="<type>"` and wraps a scroll viewport
 * (`data-cv-scroll`) with its natural-height content (`data-cv-content`).
 * The tallest natural content of each type sets the `flex-basis` of every
 * block of that type, so all cards request identical heights per section and
 * flexbox shrinks them in lockstep — outputs stay level across cards while
 * overflowing sections scroll internally. A `min-height` floor keeps every
 * section at least ~4 lines tall; when even the floors don't fit, the card
 * body falls back to scrolling as a whole.
 *
 * Returns a ref callback for the container. Pass a `key` that changes
 * whenever the set of cards changes so observers re-register; content-size
 * changes (streaming output, view-mode switches) re-measure automatically.
 */
export const useEqualBlockHeights = (key: string) => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const type of BLOCK_TYPES) {
      const blocks = root.querySelectorAll<HTMLElement>(
        `[data-cv-block="${type}"]`,
      );
      const entries: Array<{
        block: HTMLElement;
        chrome: number;
        natural: number;
      }> = [];
      for (const block of blocks) {
        const viewport = block.querySelector<HTMLElement>('[data-cv-scroll]');
        const content = block.querySelector<HTMLElement>('[data-cv-content]');
        if (!viewport || !content) continue;
        // Header + borders — everything in the block except the viewport.
        // Independent of any flex-basis already applied, so no clearing pass.
        const chrome = block.offsetHeight - viewport.offsetHeight;
        entries.push({ block, chrome, natural: chrome + content.offsetHeight });
      }
      let max = 0;
      for (const entry of entries) max = Math.max(max, entry.natural);
      for (const entry of entries) {
        entry.block.style.flexBasis = `${max}px`;
        entry.block.style.minHeight = `${Math.min(max, entry.chrome + MIN_VIEWPORT_PX)}px`;
      }
    }
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` intentionally drives re-registration + re-measure
  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      rootRef.current = node;
      if (!node) return;
      // Re-measure on root width changes (text rewraps) and on content-height
      // changes (streaming output, diff/full switches). Card-set changes are
      // handled by `key` recreating this callback.
      const observer = new ResizeObserver(schedule);
      observer.observe(node);
      for (const content of node.querySelectorAll('[data-cv-content]')) {
        observer.observe(content);
      }
      observerRef.current = observer;
      schedule();
    },
    [schedule, key],
  );
};
