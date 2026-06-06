import { useCallback, useRef } from 'react';
import { cn } from '~/lib/utils';

export type ScrollSectionType = 'system' | 'user' | 'output';

type ScrollSectionProps = {
  /** Section identity — drives cross-card scroll syncing and measurement. */
  section: ScrollSectionType;
  /** Pin the view to the bottom as content streams in. */
  follow?: boolean;
  className?: string;
  /** Override the fade gradient source colour (defaults to the card bg). */
  fadeClassName?: string;
  children: React.ReactNode;
};

/**
 * Height-constrained scroll viewport for a version-card section. Tracks
 * overflow state via data attributes (`data-overflowing` / `data-at-bottom`)
 * which drive the bottom fade affordance in CSS, and — when `follow` is on —
 * keeps the view pinned to the newest streamed content until the user scrolls
 * away from the bottom (scrolling back re-engages the follow).
 */
export const ScrollSection = ({
  section,
  follow = false,
  className,
  fadeClassName,
  children,
}: ScrollSectionProps) => {
  // User intent: auto-follow stays on until they scroll up mid-stream.
  const wantsFollowRef = useRef(true);
  // Set when we move scrollTop ourselves so the scroll handler can tell
  // pin-to-bottom scrolls apart from user scrolls.
  const programmaticRef = useRef(false);
  // One-shot: the final stream flush renders in the same pass that turns
  // `follow` off, so allow one more pin to catch the tail of the output.
  const finalPinRef = useRef(false);
  const followRef = useRef(follow);
  if (follow && !followRef.current) {
    // A new stream is starting — re-arm auto-follow.
    wantsFollowRef.current = true;
  }
  if (!follow && followRef.current) {
    finalPinRef.current = true;
  }
  followRef.current = follow;

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    const isAtBottom = () =>
      node.scrollTop + node.clientHeight >= node.scrollHeight - 2;

    const update = () => {
      node.dataset.overflowing = String(
        node.scrollHeight > node.clientHeight + 1,
      );
      node.dataset.atBottom = String(isAtBottom());
    };

    const onScroll = () => {
      if (programmaticRef.current) {
        programmaticRef.current = false;
      } else {
        finalPinRef.current = false;
        if (followRef.current) {
          wantsFollowRef.current = isAtBottom();
        }
      }
      update();
    };

    // Content growth (streaming) and viewport resizes (flex re-distribution)
    // both land here — keep the bottom pinned while following.
    const observer = new ResizeObserver(() => {
      if (
        (followRef.current || finalPinRef.current) &&
        wantsFollowRef.current &&
        node.scrollHeight > node.clientHeight
      ) {
        finalPinRef.current = false;
        programmaticRef.current = true;
        node.scrollTop = node.scrollHeight;
      }
      update();
    });

    node.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    update();

    return () => {
      node.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={viewportRef}
        data-cv-scroll={section}
        className={cn('cv-scroll h-full overflow-y-auto', className)}
      >
        {children}
      </div>
      <div aria-hidden className={cn('cv-scroll-fade', fadeClassName)} />
    </div>
  );
};
