import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

export interface ReorderCollectionMaterialsVariables {
  collectionId: string;
  orderedMaterialIds: string[];
}

/**
 * Mutation hook for reordering the materials within a collection.
 * On success: invalidates the collection materials cache.
 */
export function useReorderCollectionMaterials() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useReorderCollectionMaterials');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ collectionId, orderedMaterialIds }: ReorderCollectionMaterialsVariables) =>
      context.useCases.collections.reorderCollectionMaterials.execute(
        collectionId,
        orderedMaterialIds,
      ),

    onSuccess: (_reordered, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.materials(variables.collectionId),
      });
    },

    onError: () => {
      showToast('Failed to reorder collection materials', { intent: 'error' });
    },
  });
}
