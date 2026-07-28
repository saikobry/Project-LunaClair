import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';

/**
 * Query hook for resolving a single Term by ID.
 */
export function useTerm(termId: string | undefined) {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useTerm must be used within a <RepositoryProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...libraryQueryKeys.root, 'term', termId ?? ''],
    queryFn: ({ signal }) => context.termRepository.getTermById(termId!, signal),
    enabled: !!termId,
  });

  return { term: data ?? null, isLoading, isError, error };
}
