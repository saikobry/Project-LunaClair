import { useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';

/**
 * Hook providing document extraction, import commit, and AI cleanup use cases.
 */
export function useImporterContext() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useImporterContext must be used within ApplicationContext provider');
  }

  return context.useCases.importer;
}
