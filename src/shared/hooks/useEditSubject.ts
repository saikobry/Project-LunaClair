import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import type { UpdateSubjectInput } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

interface EditSubjectVariables {
  id: string;
  input: UpdateSubjectInput;
}

/**
 * Mutation hook for updating a subject's title, description, or order.
 * On success: shows a confirmation toast and invalidates the subjects query.
 */
export function useEditSubject() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(RepositoryContext, 'useEditSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: EditSubjectVariables) =>
      context.subjectRepository.updateSubject(id, input),

    onSuccess: () => {
      showToast('Subject updated', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
    },
  });
}
