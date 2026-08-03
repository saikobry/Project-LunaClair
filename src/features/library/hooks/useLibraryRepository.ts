import { useContext } from 'react';
import { ApplicationContext, type ApplicationContextValue } from '../../../app/providers/ApplicationContext';

/**
 * Dependency injection hook that returns the LibraryRepository from context.
 * All feature hooks and components should use this to access the repository
 * rather than importing concrete implementations directly.
 */
export function useLibraryRepository(): ApplicationContextValue {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error(
      'useLibraryRepository must be used within a <ApplicationProvider>',
    );
  }
  return context;
}
