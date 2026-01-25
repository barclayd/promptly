import { useState } from 'react';

let listenerSetup = false;
let setOpenRef: { current: ((open: boolean) => void) | null } = { current: null };

const setupKeyboardListener = () => {
  if (typeof window === 'undefined') return;
  if (listenerSetup) return;
  listenerSetup = true;

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpenRef.current?.(true);
    }
  });
};

export const useSearch = () => {
  const [open, setOpen] = useState(false);

  // Keep the ref updated with the latest setOpen
  setOpenRef.current = setOpen;

  setupKeyboardListener();

  return { open, setOpen };
};
