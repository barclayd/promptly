import { useCallback, useState } from 'react';

type UseInViewOptions = {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
};

export const useInView = (options: UseInViewOptions = {}) => {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const [isInView, setIsInView] = useState(false);

  // Ref callback pattern - no useEffect needed
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;

      // Skip if already triggered and triggerOnce is true
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
