import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook for resolving the `StudyMaterial[]` belonging to a collection,
 * ordered by each link's `order` in `collectionMaterials`.
 *
 * Reads junction rows via the `CollectionMaterialRepository` port, then
 * resolves materials through the `LibraryRepository` port and re-applies
 * the junction ordering (map lookups do not preserve it).
 */
export function useCollectionMaterials(collectionId: string | undefined) {
  const context = useContextOrThrow(ApplicationContext, 'useCollectionMaterials');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.materials(collectionId ?? ''),
    queryFn: async ({ signal }) => {
      const links = await context.repositories.collectionMaterial.getByCollectionId(
        collectionId!,
        signal,
      );
      if (links.length === 0) return [];
      const ordered = links.toSorted((a, b) => a.order - b.order);
      const all = await context.repositories.library.getMaterials(signal);
      const byId = new Map(all.map((m) => [m.id, m]));
      return ordered.flatMap((link) => {
        const material = byId.get(link.materialId);
        return material ? [material] : [];
      });
    },
    enabled: !!collectionId,
  });

  return { materials: data ?? [], isLoading, isError, error };
}
