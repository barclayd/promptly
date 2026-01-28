import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};

const getSnapshot = () => {
  return document.documentElement.classList.contains('dark');
};

const getServerSnapshot = () => false;

export const useIsDarkMode = () => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
