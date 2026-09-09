import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Query hook for resolving a single Collection by ID.
 */
export function useCollection(collectionId: string | undefined) {
  const context = useContextOrThrow(ApplicationContext, 'useCollection');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: collectionQueryKeys.detail(collectionId ?? ''),
    queryFn: ({ signal }) => context.repositories.collection.getById(collectionId!, signal),
    enabled: !!collectionId,
  });

  return { collection: data ?? null, isLoading, isError, error };
}
