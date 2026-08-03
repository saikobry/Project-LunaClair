import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';

/**
 * Query hook for resolving a single Subject by ID.
 */
export function useSubject(subjectId: string | undefined) {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useSubject must be used within a <ApplicationProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...libraryQueryKeys.root, 'subject', subjectId ?? ''],
    queryFn: ({ signal }) => context.subjectRepository.getSubjectById(subjectId!, signal),
    enabled: !!subjectId,
  });

  return { subject: data ?? null, isLoading, isError, error };
}
