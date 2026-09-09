import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook for resolving the `StudyMaterial[]` that belong to no
 * collection (zero rows in `collectionMaterials`).
 */
export function useUnassignedMaterials() {
  const context = useContextOrThrow(ApplicationContext, 'useUnassignedMaterials');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.unassigned(),
    queryFn: async ({ signal }) => {
      const [materials, collections] = await Promise.all([
        context.repositories.library.getMaterials(signal),
        context.repositories.collection.getAll(signal),
      ]);
      const linkArrays = await Promise.all(
        collections.map((c) => context.repositories.collectionMaterial.getByCollectionId(c.id, signal)),
      );
      const assigned = new Set(linkArrays.flatMap((links) => links.map((l) => l.materialId)));
      return materials.filter((m) => !assigned.has(m.id));
    },
  });

  return { materials: data ?? [], isLoading, isError, error };
}
