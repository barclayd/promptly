import type { ClientStateReader } from './types';

export const createClientStateReader = (): ClientStateReader => ({
  getLocal: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  getSession: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
});
