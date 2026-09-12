import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
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
 * Uses optimistic cache updates to prevent UI flicker when reordering items.
 * On settled: invalidates the collection materials and material-counts caches to reconcile.
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

    onMutate: async ({ collectionId, orderedMaterialIds }: ReorderCollectionMaterialsVariables) => {
      await queryClient.cancelQueries({
        queryKey: collectionQueryKeys.materials(collectionId),
      });

      const previous = queryClient.getQueryData<StudyMaterial[]>(
        collectionQueryKeys.materials(collectionId),
      );

      if (previous) {
        const map = new Map(previous.map((m) => [m.id, m]));
        const reordered = orderedMaterialIds.flatMap((id) => {
          const item = map.get(id);
          return item ? [item] : [];
        });
        queryClient.setQueryData<StudyMaterial[]>(
          collectionQueryKeys.materials(collectionId),
          reordered,
        );
      }

      return { previous };
    },

    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          collectionQueryKeys.materials(variables.collectionId),
          context.previous,
        );
      }
      showToast('Failed to reorder collection materials', { intent: 'error' });
    },

    onSettled: (_data, _error, variables) => {
      if (variables?.collectionId) {
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.materials(variables.collectionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.materialCounts() });
    },
  });
}
