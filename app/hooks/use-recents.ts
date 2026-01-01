'use client';

import { useSyncExternalStore } from 'react';

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

type PromptInfo = Omit<RecentPrompt, 'lastSeenAt'>;

const getRecentsFromStorage = (): RecentPrompt[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addRecentToStorage = (prompt: PromptInfo) => {
  const current = getRecentsFromStorage();
  const filtered = current.filter((r) => r.promptId !== prompt.promptId);
  const updated = [{ ...prompt, lastSeenAt: Date.now() }, ...filtered].slice(
    0,
    MAX_RECENTS,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
};

// Parse prompt URL to extract folderId and promptId
const parsePromptUrl = (
  url: string,
): { folderId: string; promptId: string } | null => {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/^\/prompts\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { folderId: match[1], promptId: match[2] };
  } catch {
    return null;
  }
};

// Fetch prompt info from server
const fetchPromptInfo = async (
  folderId: string,
  promptId: string,
): Promise<PromptInfo | null> => {
  try {
    const response = await fetch(
      `/api/prompt-info?folderId=${folderId}&promptId=${promptId}`,
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

// Set up navigation listener (called once on module load)
let listenerSetup = false;

const setupNavigationListener = () => {
  if (typeof window === 'undefined') return;
  if (listenerSetup) return;
  if (!('navigation' in window)) return;

  listenerSetup = true;
  const nav = window.navigation as Navigation;

  nav.addEventListener('currententrychange', (event) => {
    const fromEntry = (event as NavigationCurrentEntryChangeEvent).from;
    if (!fromEntry) return;

    const fromUrl = fromEntry.url;
    if (!fromUrl) return;

    const parsed = parsePromptUrl(fromUrl);
    if (!parsed) return;

    fetchPromptInfo(parsed.folderId, parsed.promptId).then((info) => {
      if (info) {
        addRecentToStorage(info);
      }
    });
  });
};

if (typeof window !== 'undefined') {
  setupNavigationListener();
}

const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

const getSnapshot = () => {
  return localStorage.getItem(STORAGE_KEY) ?? '[]';
};

const getServerSnapshot = () => '[]';

export const useRecents = () => {
  // Ensure listener is set up (in case module init didn't run)
  setupNavigationListener();

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

  return { recents };
};
