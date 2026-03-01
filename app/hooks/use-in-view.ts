import { useCallback, useState } from 'react';

type UseInViewOptions = {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  /** Start visible immediately — skips IntersectionObserver. Use for above-fold content to avoid LCP delays from waiting for JS hydration. */
  initiallyVisible?: boolean;
};

export const useInView = (options: UseInViewOptions = {}) => {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    triggerOnce = true,
    initiallyVisible = false,
  } = options;
  const [isInView, setIsInView] = useState(initiallyVisible);

  // Ref callback pattern - no useEffect needed
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;

      // Skip observer entirely if already visible (above-fold content)
      if (isInView && triggerOnce) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (triggerOnce) {
              observer.disconnect();
            }
          } else if (!triggerOnce) {
            setIsInView(false);
          }
        },
        { threshold, rootMargin },
      );

      observer.observe(node);

      // Cleanup on unmount happens automatically when ref is called with null
      return () => observer.disconnect();
    },
    [threshold, rootMargin, triggerOnce, isInView],
  );

  return { ref, isInView };
};
