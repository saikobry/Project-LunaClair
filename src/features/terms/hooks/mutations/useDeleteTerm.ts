import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { termQueryKeys } from '../../queries/termQueryKeys';
import { materialQueryKeys } from '../../../materials/queries/materialQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Mutation hook for deleting a global term.
 *
 * Cascades: removes all SubjectTerm junction rows referencing the term
 * and clears termId on any StudyMaterial that references it (handled
 * by DexieTermRepository.deleteTerm).
 *
 * On success: shows a confirmation toast and invalidates both terms
 * and subject-terms queries.
 */
export function useDeleteTerm() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useDeleteTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (termId: string) => context.useCases.subject.deleteTerm.execute(termId),

    onSuccess: () => {
      showToast('Term deleted', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: termQueryKeys.terms() });
      queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
    },
  });
}
