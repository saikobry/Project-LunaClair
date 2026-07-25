import { useRef, type ReactNode } from 'react';
import { RepositoryContext, type RepositoryContextValue } from './RepositoryContext';
import { localStorageLibraryRepository } from '../../services/storage/LocalStorageLibraryRepository';

interface RepositoryProviderProps {
  children: ReactNode;
}

/**
 * Provides the LibraryRepository to all feature hooks via React context.
 * The repository instance is a stable singleton that never recreates across re-renders.
 */
export function RepositoryProvider({ children }: RepositoryProviderProps) {
  const ref = useRef<RepositoryContextValue>({
    libraryRepository: localStorageLibraryRepository,
  });

  return (
    <RepositoryContext.Provider value={ref.current}>
      {children}
    </RepositoryContext.Provider>
  );
}
