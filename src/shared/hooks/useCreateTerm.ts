import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import type { CreateTermInput } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

/**
 * Mutation hook for creating a new global term.
 * On success: shows a confirmation toast and invalidates the terms query.
 */
export function useCreateTerm() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(RepositoryContext, 'useCreateTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateTermInput) => context.termRepository.createTerm(input),

    onSuccess: () => {
      showToast('Term created', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: [...libraryQueryKeys.root, 'terms'] });
    },
  });
}
