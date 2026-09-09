import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook for fetching all collections, sorted by their `order` field.
 */
export function useCollections() {
  const context = useContextOrThrow(ApplicationContext, 'useCollections');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.lists(),
    queryFn: ({ signal }) => context.repositories.collection.getAll(signal),
  });

  const collections = useMemo(
    () => (data ?? []).toSorted((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [data],
  );

  return { collections, isLoading, isError, error };
}
