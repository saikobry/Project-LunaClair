import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { subjectQueryKeys } from '../../queries/subjectQueryKeys';
import { materialQueryKeys } from '../../../materials/queries/materialQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

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
      queryClient.invalidateQueries({ queryKey: subjectQueryKeys.subjects() });
      queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
    },
  });
}
