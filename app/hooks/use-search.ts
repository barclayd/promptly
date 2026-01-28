import { useState } from 'react';

let listenerSetup = false;
const setOpenRef: { current: ((open: boolean) => void) | null } = {
  current: null,
};
const openRef: { current: boolean } = { current: false };

const setupKeyboardListener = () => {
  if (typeof window === 'undefined') return;
  if (listenerSetup) return;
  listenerSetup = true;

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpenRef.current?.(!openRef.current);
    }
  });
};

export const useSearch = () => {
  const [open, setOpen] = useState(false);

  // Keep the refs updated with the latest values
  setOpenRef.current = setOpen;
  openRef.current = open;

  setupKeyboardListener();

  return { open, setOpen };
};
