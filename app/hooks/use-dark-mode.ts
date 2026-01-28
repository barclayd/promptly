import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'theme';

const subscribe = (callback: () => void) => {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', callback);
  query.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    query.removeEventListener('change', callback);
  };
};

const getIsDark = () => document.documentElement.classList.contains('dark');

const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
};

export const setTheme = (theme: Theme) => {
  localStorage.setItem(THEME_KEY, theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }));
};

export const useTheme = () => {
  const isDark = useSyncExternalStore(subscribe, getIsDark, () => false);
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'system');
  return { theme, isDark, setTheme };
};

// Keep backward compatibility
export const useIsDarkMode = () => useTheme().isDark;
