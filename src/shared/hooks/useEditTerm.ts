import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import type { UpdateTermInput } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

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
  const context = useContextOrThrow(RepositoryContext, 'useEditTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: EditTermVariables) =>
      context.termRepository.updateTerm(id, input),

    onSuccess: () => {
      showToast('Term updated', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: [...libraryQueryKeys.root, 'terms'] });
    },
  });
}
