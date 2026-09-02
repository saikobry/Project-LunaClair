import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { UpdateTermInput } from '../../../../../domain/library/repositories/TermRepository';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';

interface EditTermVariables {
  id: string;
  input: UpdateTermInput;
}

/**
 * Mutation hook for updating a global term's title.
 * On success: shows a confirmation toast and invalidates the terms query.
 */
export function useEditTerm() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useEditTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: EditTermVariables) =>
      context.useCases.subject.updateTerm.execute(id, input),

    onSuccess: () => {
      showToast('Term updated', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.terms() });
    },
  });
}
