import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import type { CreateSubjectInput } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

/**
 * Mutation hook for creating a new subject.
 * On success: shows a confirmation toast and invalidates the subjects query.
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(RepositoryContext, 'useCreateSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateSubjectInput) => context.subjectRepository.createSubject(input),

    onSuccess: () => {
      showToast('Subject created', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
    },
  });
}
