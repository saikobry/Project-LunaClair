import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';

/**
 * Query hook for resolving a single Term by ID.
 */
export function useTerm(termId: string | undefined) {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useTerm must be used within a <ApplicationProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: catalogQueryKeys.term(termId ?? ''),
    queryFn: ({ signal }) => context.repositories.term.getTermById(termId!, signal),
    enabled: !!termId,
  });

  return { term: data ?? null, isLoading, isError, error };
}
