'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { useSearch } from '~/hooks/use-search';
import { SearchDialog } from '~/components/search-dialog';

type SearchContextType = ReturnType<typeof useSearch>;

const SearchContext = createContext<SearchContextType | null>(null);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const search = useSearch();
  return (
    <SearchContext.Provider value={search}>
      {children}
      <SearchDialog open={search.open} onOpenChange={search.setOpen} />
    </SearchContext.Provider>
  );
};

export const useSearchContext = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearchContext must be used within SearchProvider');
  }
  return ctx;
};
