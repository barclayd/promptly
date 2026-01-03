import { useEffect, useRef } from 'react';
import { useSidebar } from '~/components/ui/sidebar';

const AUTO_HIDE_BREAKPOINT = 1000;

export const useAutoHideSidebar = () => {
  const { setOpen, open } = useSidebar();
  const wasOpenBeforeAutoHide = useRef<boolean | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${AUTO_HIDE_BREAKPOINT - 1}px)`);

    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        if (wasOpenBeforeAutoHide.current === null) {
          wasOpenBeforeAutoHide.current = openRef.current;
        }
        setOpen(false);
      } else {
        if (wasOpenBeforeAutoHide.current !== null) {
          setOpen(wasOpenBeforeAutoHide.current);
          wasOpenBeforeAutoHide.current = null;
        }
      }
    };

    onChange(mql);

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [setOpen]);
};
