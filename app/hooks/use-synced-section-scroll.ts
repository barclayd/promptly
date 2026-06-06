import { useCallback, useRef } from 'react';

/**
 * Pixel-synced scrolling across compare cards, per section type. Scroll
 * events don't bubble but they can be captured, so a single capture listener
 * on the carousel root mirrors any `[data-cv-scroll="<type>"]` viewport's
 * scrollTop onto its same-type siblings. Versions of the same prompt are
 * near-identical text, so a pixel offset keeps the same lines side-by-side.
 *
 * Output viewports are excluded while runs are streaming (`outputSyncEnabled`
 * false) so pin-to-bottom can follow each stream independently; sync
 * re-engages once every run settles.
 */
export const useSyncedSectionScroll = (outputSyncEnabled: boolean) => {
  const outputSyncRef = useRef(outputSyncEnabled);
  outputSyncRef.current = outputSyncEnabled;
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((root: HTMLElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!root) return;

    // Viewports whose next scroll event came from us, not the user.
    const echo = new WeakSet<Element>();

    const onScroll = (event: Event) => {
      const source = event.target;
      if (!(source instanceof HTMLElement)) return;
      const type = source.dataset.cvScroll;
      if (!type) return;
      if (echo.has(source)) {
        echo.delete(source);
        return;
      }
      if (type === 'output' && !outputSyncRef.current) return;
      const peers = root.querySelectorAll<HTMLElement>(
        `[data-cv-scroll="${type}"]`,
      );
      for (const peer of peers) {
        if (peer === source || peer.scrollTop === source.scrollTop) continue;
        const before = peer.scrollTop;
        peer.scrollTop = source.scrollTop;
        // Only flag as an echo if the write actually moved the viewport —
        // clamped writes fire no scroll event and would leave a stale flag.
        if (peer.scrollTop !== before) echo.add(peer);
      }
    };

    root.addEventListener('scroll', onScroll, { capture: true, passive: true });
    cleanupRef.current = () =>
      root.removeEventListener('scroll', onScroll, { capture: true });
  }, []);
};
