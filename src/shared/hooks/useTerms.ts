import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';

/**
 * Query hook for fetching Term entities.
 *
 * - When `subjectId` is provided: fetches terms scoped to that subject.
 * - When `subjectId` is omitted: fetches all terms across all subjects.
 */
export function useTerms(subjectId?: string | undefined) {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useTerms must be used within a <RepositoryProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: subjectId
      ? [...libraryQueryKeys.root, 'terms', subjectId]
      : [...libraryQueryKeys.root, 'terms'],
    queryFn: ({ signal }) =>
      subjectId
        ? context.termRepository.getTermsBySubject(subjectId, signal)
        : context.termRepository.getTerms(signal),
    enabled: true,
  });

  return { terms: data ?? [], isLoading, isError, error };
}
