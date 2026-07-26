import { useRef, type ReactNode } from 'react';
import { RepositoryContext, type RepositoryContextValue } from './RepositoryContext';
import { localStorageLibraryRepository } from '../../services/storage/LocalStorageLibraryRepository';
import { localStorageAnnotationRepository } from '../../services/storage/LocalStorageAnnotationRepository';
import { localDocumentRepository } from '../../services/content/LocalDocumentRepository';

interface RepositoryProviderProps {
  children: ReactNode;
}

/**
 * Provides all domain repositories to feature hooks via React context.
 * Repository instances are stable singletons that never recreate across re-renders.
 */
export function RepositoryProvider({ children }: RepositoryProviderProps) {
  const ref = useRef<RepositoryContextValue>({
    libraryRepository: localStorageLibraryRepository,
    documentRepository: localDocumentRepository,
    annotationRepository: localStorageAnnotationRepository,
  });

  return (
    <RepositoryContext.Provider value={ref.current}>
      {children}
    </RepositoryContext.Provider>
  );
}
