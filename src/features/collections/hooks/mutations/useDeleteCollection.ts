import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Mutation hook for deleting a collection (atomically removes the collection
 * and its `collectionMaterials` junction rows via `DeleteCollectionUseCase`).
 * On success: shows a confirmation toast and invalidates the collections cache.
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useDeleteCollection');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (collectionId: string) =>
      context.useCases.collections.deleteCollection.execute(collectionId),

    onSuccess: () => {
      showToast('Collection deleted', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
    },

    onError: () => {
      showToast('Failed to delete collection', { intent: 'error' });
    },
  });
}
