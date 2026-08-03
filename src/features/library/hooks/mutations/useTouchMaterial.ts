import { useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Touches a study material by updating its `lastOpenedAt` timestamp.
 * No optimistic update needed—this is a background side-effect.
 * On settle: invalidate the materials list to reflect the change.
 */
export function useTouchMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();

  return useMutation({
    mutationFn: (id: string) => useCases.library.touchMaterial.execute(id),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
