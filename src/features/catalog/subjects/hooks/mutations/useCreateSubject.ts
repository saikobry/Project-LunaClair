import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { CreateSubjectInput } from '../../../../../domain/library';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';

/**
 * Mutation hook for creating a new subject.
 * On success: shows a confirmation toast and invalidates the subjects query.
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useCreateSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateSubjectInput) => context.subjectRepository.createSubject(input),

    onSuccess: () => {
      showToast('Subject created', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subjects() });
    },
  });
}
