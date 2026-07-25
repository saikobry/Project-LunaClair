import { useContext } from 'react';
import { RepositoryContext, type RepositoryContextValue } from '../../../app/providers/RepositoryContext';

/**
 * Dependency injection hook that returns the LibraryRepository from context.
 * All feature hooks and components should use this to access the repository
 * rather than importing concrete implementations directly.
 */
export function useLibraryRepository(): RepositoryContextValue {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error(
      'useLibraryRepository must be used within a <RepositoryProvider>',
    );
  }
  return context;
}
