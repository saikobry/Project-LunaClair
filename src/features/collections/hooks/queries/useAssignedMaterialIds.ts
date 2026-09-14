import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook resolving the set of material ids that belong to **at least one**
 * collection.
 *
 * This is the read model behind the Library membership filter: one `Set` answers
 * both `collected` (member) and `uncollected` (non-member) predicates, so the
 * screen never needs two round-trips.
 */
export function useAssignedMaterialIds() {
  const context = useContextOrThrow(ApplicationContext, 'useAssignedMaterialIds');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.assignedMaterialIds(),
    queryFn: async ({ signal }) => {
      const collections = await context.repositories.collection.getAll(signal);
      const linkArrays = await Promise.all(
        collections.map((c) => context.repositories.collectionMaterial.getByCollectionId(c.id, signal)),
      );
      return new Set(linkArrays.flatMap((links) => links.map((l) => l.materialId)));
    },
  });

  return {
    assignedIds: data ?? EMPTY_ASSIGNED_IDS,
    isLoading,
    isError,
    error,
  };
}

/**
 * Stable empty set — a fresh `new Set()` per render would churn memo
 * dependencies in callers while the query is still loading.
 */
const EMPTY_ASSIGNED_IDS: ReadonlySet<string> = new Set<string>();
