'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'promptly-recents';
const MAX_RECENTS = 10;

export interface RecentPrompt {
  promptId: string;
  promptName: string;
  folderId: string;
  folderName: string;
  version: string | null;
  url: string;
  lastSeenAt: number;
}

const getRecentsFromStorage = (): RecentPrompt[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

const getSnapshot = () => {
  return localStorage.getItem(STORAGE_KEY) ?? '[]';
};

const getServerSnapshot = () => '[]';

export const useRecents = () => {
  const recentsJson = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const recents: RecentPrompt[] = (() => {
    try {
      return JSON.parse(recentsJson);
    } catch {
      return [];
    }
  })();

  const addRecent = useCallback((prompt: Omit<RecentPrompt, 'lastSeenAt'>) => {
    const current = getRecentsFromStorage();

    const filtered = current.filter((r) => r.promptId !== prompt.promptId);

    const updated = [{ ...prompt, lastSeenAt: Date.now() }, ...filtered].slice(
      0,
      MAX_RECENTS,
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, []);

  return { recents, addRecent };
};
