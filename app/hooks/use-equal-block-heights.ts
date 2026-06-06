import { useCallback, useRef } from 'react';

const BLOCK_TYPES = ['system', 'user'] as const;

/**
 * Equalises the height of repeated blocks across sibling cards so the content
 * below them lines up. Each block carries `data-cv-block="<type>"`; the tallest
 * block of each type sets a `min-height` applied to every block of that type.
 *
 * Returns a ref callback for the container. Pass a `key` that changes whenever
 * the set of cards or their content mode changes so the measurement re-runs.
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
      // Clear prior constraints so we read each block's natural height.
      for (const block of blocks) {
        block.style.minHeight = '';
      }
      let max = 0;
      for (const block of blocks) {
        max = Math.max(max, block.offsetHeight);
      }
      for (const block of blocks) {
        block.style.minHeight = `${max}px`;
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
      // Re-measure on width changes (text rewraps); content-mode and card-set
      // changes are handled by `key` recreating this callback.
      const observer = new ResizeObserver(schedule);
      observer.observe(node);
      observerRef.current = observer;
      schedule();
    },
    [schedule, key],
  );
};
