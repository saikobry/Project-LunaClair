import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import type { Subject } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

interface ReorderVariables {
  /** Full ordered list of subject IDs in their final desired order. */
  orderedIds: string[];
}

/**
 * Mutation hook for batch subject reordering with optimistic updates.
 *
 * - `onMutate`: Immediately reorders the React Query cache so the UI
 *   does not snap back to the original order while the write is in flight.
 * - `onError`: Rolls back to the previous cache on failure.
 * - `onSettled`: Invalidates the query to reconcile with the persisted state.
 * - Single "Subject order saved" toast on success.
 */
export function useReorderSubjects() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useReorderSubjects');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ orderedIds }: ReorderVariables) => {
      await context.subjectRepository.reorderSubjects(orderedIds);
    },

    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: libraryQueryKeys.subjects() });
      const previousSubjects = queryClient.getQueryData<Subject[]>(libraryQueryKeys.subjects());

      if (previousSubjects) {
        const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
        const optimisticallyOrdered = previousSubjects
          .toSorted((a, b) => {
            const orderA = orderMap.get(a.id) ?? 999;
            const orderB = orderMap.get(b.id) ?? 999;
            return orderA - orderB;
          })
          .map((s) => ({ ...s, order: orderMap.get(s.id) ?? s.order }));

        queryClient.setQueryData(libraryQueryKeys.subjects(), optimisticallyOrdered);
      }

      return { previousSubjects };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previousSubjects) {
        queryClient.setQueryData(libraryQueryKeys.subjects(), ctx.previousSubjects);
      }
      showToast('Failed to save subject order', { intent: 'error' });
    },

    onSuccess: () => {
      showToast('Subject order saved', { intent: 'success' });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
    },
  });
}
