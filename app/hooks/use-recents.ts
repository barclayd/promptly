'use client';

import { useSyncExternalStore } from 'react';

// Navigation API types (not yet in standard TypeScript lib)
interface NavigationCurrentEntryChangeEvent extends Event {
  from?: { url?: string };
}

interface Navigation extends EventTarget {
  addEventListener(
    type: 'currententrychange',
    listener: (event: NavigationCurrentEntryChangeEvent) => void,
  ): void;
}

const STORAGE_KEY = 'promptly-recents';
const MAX_RECENTS = 10;

export interface RecentPrompt {
  promptId: string;
  promptName: string;
  snippetName?: string;
  composerName?: string;
  type?: 'prompt' | 'snippet' | 'composer';
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
  const filtered = current.filter((r) => r.url !== prompt.url);
  const updated = [{ ...prompt, lastSeenAt: Date.now() }, ...filtered].slice(
    0,
    MAX_RECENTS,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
};

const removeRecentFromStorage = (url: string) => {
  const current = getRecentsFromStorage();
  const updated = current.filter((r) => r.url !== url);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
};

// Parse resource URL to extract id and type
const parseResourceUrl = (
  url: string,
): { id: string; type: 'prompt' | 'snippet' | 'composer' } | null => {
  try {
    const { pathname } = new URL(url);
    const promptMatch = pathname.match(/^\/prompts\/([^/]+)$/);
    if (promptMatch) return { id: promptMatch[1], type: 'prompt' };
    const snippetMatch = pathname.match(/^\/snippets\/([^/]+)$/);
    if (snippetMatch) return { id: snippetMatch[1], type: 'snippet' };
    const composerMatch = pathname.match(/^\/composers\/([^/]+)$/);
    if (composerMatch) return { id: composerMatch[1], type: 'composer' };
    return null;
  } catch {
    return null;
  }
};

// Fetch prompt info from server
const fetchPromptInfo = async (
  promptId: string,
): Promise<PromptInfo | null> => {
  try {
    const response = await fetch(`/api/prompt-info?promptId=${promptId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

// Fetch snippet info from server
const fetchSnippetInfo = async (
  snippetId: string,
): Promise<PromptInfo | null> => {
  try {
    const response = await fetch(`/api/snippet-info?snippetId=${snippetId}`);
    if (!response.ok) return null;
    const info = (await response.json()) as {
      snippetId: string;
      snippetName: string;
      folderId: string;
      folderName: string;
      version: string | null;
      url: string;
    };
    return {
      promptId: info.snippetId,
      promptName: info.snippetName,
      snippetName: info.snippetName,
      type: 'snippet' as const,
      folderId: info.folderId,
      folderName: info.folderName,
      version: info.version,
      url: info.url,
    };
  } catch {
    return null;
  }
};

// Fetch composer info from server
const fetchComposerInfo = async (
  composerId: string,
): Promise<PromptInfo | null> => {
  try {
    const response = await fetch(`/api/composer-info?composerId=${composerId}`);
    if (!response.ok) return null;
    const info = (await response.json()) as {
      composerId: string;
      composerName: string;
      folderId: string;
      folderName: string;
      version: string | null;
      url: string;
    };
    return {
      promptId: info.composerId,
      promptName: info.composerName,
      composerName: info.composerName,
      type: 'composer' as const,
      folderId: info.folderId,
      folderName: info.folderName,
      version: info.version,
      url: info.url,
    };
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
  const nav = (window as Window & { navigation?: Navigation }).navigation;
  if (!nav) return;

  nav.addEventListener('currententrychange', (event) => {
    const fromEntry = event.from;
    if (!fromEntry) return;

    const fromUrl = fromEntry.url;
    if (!fromUrl) return;

    const parsed = parseResourceUrl(fromUrl);
    if (!parsed) return;

    const fetchFn =
      parsed.type === 'composer'
        ? fetchComposerInfo
        : parsed.type === 'snippet'
          ? fetchSnippetInfo
          : fetchPromptInfo;
    fetchFn(parsed.id).then((info) => {
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

  const removeRecent = (url: string) => {
    removeRecentFromStorage(url);
  };

  return { recents, removeRecent };
};
