import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook resolving per-collection material counts
 * (`collectionId -> member count`) for sidebar badges.
 *
 * Reads via DI context — never concrete infrastructure. Counts are derived
 * from `CollectionMaterialRepository.getByCollectionId` link rows.
 * Invalidated by every membership mutation (add/remove/reorder) and by
 * collection create/delete (via the `collections` root key).
 */
export function useCollectionMaterialCounts() {
  const context = useContextOrThrow(ApplicationContext, 'useCollectionMaterialCounts');

  const { data, isLoading } = useQuery({
    queryKey: collectionQueryKeys.materialCounts(),
    queryFn: async ({ signal }) => {
      const collections = await context.repositories.collection.getAll(signal);
      const entries = await Promise.all(
        collections.map(async (collection) => {
          const links = await context.repositories.collectionMaterial.getByCollectionId(
            collection.id,
            signal,
          );
          return [collection.id, links.length] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  return { counts: data ?? {}, isLoading };
}
