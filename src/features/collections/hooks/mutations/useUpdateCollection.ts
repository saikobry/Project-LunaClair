import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { UpdateCollectionInput } from '../../../../domain/collections/models/Collection';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

export interface UpdateCollectionVariables {
  id: string;
  input: UpdateCollectionInput;
}

/**
 * Mutation hook for updating a collection.
 * On success: shows a confirmation toast and invalidates the list + detail cache.
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useUpdateCollection');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: UpdateCollectionVariables) =>
      context.useCases.collections.updateCollection.execute(id, input),

    onSuccess: (_updated, variables) => {
      showToast('Collection updated', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.detail(variables.id) });
    },

    onError: () => {
      showToast('Failed to update collection', { intent: 'error' });
    },
  });
}
