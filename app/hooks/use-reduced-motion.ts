import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

const subscribe = (callback: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
};

const getSnapshot = () => window.matchMedia(query).matches;

const getServerSnapshot = () => false;

export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
