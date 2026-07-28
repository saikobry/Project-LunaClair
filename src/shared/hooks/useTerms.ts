import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';

/**
 * Query hook for fetching Term entities by subjectId.
 */
export function useTerms(subjectId: string | undefined) {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useTerms must be used within a <RepositoryProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...libraryQueryKeys.root, 'terms', subjectId ?? ''],
    queryFn: ({ signal }) => context.termRepository.getTermsBySubject(subjectId!, signal),
    enabled: !!subjectId,
  });

  return { terms: data ?? [], isLoading, isError, error };
}
