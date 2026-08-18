import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { UpdateSubjectInput } from '../../../../../domain/library';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';

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
  const context = useContextOrThrow(ApplicationContext, 'useEditSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: EditSubjectVariables) =>
      context.useCases.subject.updateSubject.execute(id, input),

    onSuccess: () => {
      showToast('Subject updated', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subjects() });
    },
  });
}
