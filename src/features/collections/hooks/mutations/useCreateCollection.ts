import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { CreateCollectionInput } from '../../../../domain/collections/models/Collection';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Mutation hook for creating a new collection.
 * On success: shows a confirmation toast and invalidates the collections cache.
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useCreateCollection');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateCollectionInput) =>
      context.useCases.collections.createCollection.execute(input),

    onSuccess: (created) => {
      showToast(`Collection "${created.title}" created`, { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
    },

    onError: () => {
      showToast('Failed to create collection', { intent: 'error' });
    },
  });
}
