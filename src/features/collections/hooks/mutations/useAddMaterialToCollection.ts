import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

export interface AddMaterialToCollectionVariables {
  collectionId: string;
  materialId: string;
}

/**
 * Mutation hook for adding a material to a collection.
 * On success: invalidates the collection materials, material-collections,
 * and unassigned-materials caches.
 */
export function useAddMaterialToCollection() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useAddMaterialToCollection');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ collectionId, materialId }: AddMaterialToCollectionVariables) =>
      context.useCases.collections.addMaterialToCollection.execute(collectionId, materialId),

    onSuccess: (_added, variables) => {
      showToast('Material added to collection', { intent: 'success' });
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.materials(variables.collectionId),
      });
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.materialCollections(variables.materialId),
      });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.unassigned() });
    },

    onError: () => {
      showToast('Failed to add material to collection', { intent: 'error' });
    },
  });
}
