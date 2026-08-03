import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { CreateTermInput } from '../../../../domain/library';
import { subjectQueryKeys } from '../../queries/subjectQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Mutation hook for creating a new global term.
 * On success: shows a confirmation toast and invalidates the terms query.
 */
export function useCreateTerm() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useCreateTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateTermInput) => context.termRepository.createTerm(input),

    onSuccess: () => {
      showToast('Term created', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: subjectQueryKeys.terms() });
    },
  });
}
