'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { useRecents } from '~/hooks/use-recents';

type RecentsContextType = ReturnType<typeof useRecents>;

const RecentsContext = createContext<RecentsContextType | null>(null);

export const RecentsProvider = ({ children }: { children: ReactNode }) => {
  const recents = useRecents();
  return (
    <RecentsContext.Provider value={recents}>
      {children}
    </RecentsContext.Provider>
  );
};

export const useRecentsContext = () => {
  const ctx = useContext(RecentsContext);
  if (!ctx) {
    throw new Error('useRecentsContext must be used within RecentsProvider');
  }
  return ctx;
};
