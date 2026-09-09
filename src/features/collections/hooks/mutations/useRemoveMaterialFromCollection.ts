import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

export interface RemoveMaterialFromCollectionVariables {
  collectionId: string;
  materialId: string;
}

/**
 * Mutation hook for removing a material from a collection.
 * On success: invalidates the collection materials, material-collections,
 * and unassigned-materials caches.
 */
export function useRemoveMaterialFromCollection() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useRemoveMaterialFromCollection');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ collectionId, materialId }: RemoveMaterialFromCollectionVariables) =>
      context.useCases.collections.removeMaterialFromCollection.execute(collectionId, materialId),

    onSuccess: (_removed, variables) => {
      showToast('Material removed from collection', { intent: 'success' });
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.materials(variables.collectionId),
      });
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.materialCollections(variables.materialId),
      });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.unassigned() });
    },

    onError: () => {
      showToast('Failed to remove material from collection', { intent: 'error' });
    },
  });
}
