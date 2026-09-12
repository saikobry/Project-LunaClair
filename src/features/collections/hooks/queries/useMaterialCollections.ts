import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook for resolving the collections that contain a material.
 * Returns both the `Collection[]` (for display) and the raw `collectionIds`.
 */
export function useMaterialCollections(materialId: string | undefined) {
  const context = useContextOrThrow(ApplicationContext, 'useMaterialCollections');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.materialCollections(materialId ?? ''),
    queryFn: async ({ signal }) => {
      const links = await context.repositories.collectionMaterial.getByMaterialId(
        materialId!,
        signal,
      );
      if (links.length === 0) return [];
      const ids = new Set(links.map((l) => l.collectionId));
      const all = await context.repositories.collection.getAll(signal);
      return all
        .toSorted((a, b) => a.order - b.order || a.title.localeCompare(b.title))
        .filter((c) => ids.has(c.id));
    },
    enabled: !!materialId,
  });

  return {
    collections: data ?? [],
    collectionIds: (data ?? []).map((c) => c.id),
    isLoading,
    isError,
    error,
  };
}
