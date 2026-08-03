import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

/**
 * Mutation hook for deleting a subject.
 *
 * Also unassigns all materials that belonged to the deleted subject
 * by setting their `subjectId` to `undefined`.
 *
 * On success: shows a confirmation toast and invalidates both subjects
 * and materials queries.
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useDeleteSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (subjectId: string) => context.useCases.subject.deleteSubject.execute(subjectId),

    onSuccess: () => {
      showToast('Subject deleted', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
