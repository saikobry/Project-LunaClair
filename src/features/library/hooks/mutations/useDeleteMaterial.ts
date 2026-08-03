import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Deletes a study material with optimistic cache removal.
 * On mutation start: snapshot → optimistically filter out → rollback on error.
 * On success: show confirmation toast.
 * On settle: invalidate to reconcile.
 */
export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => useCases.library.deleteMaterial.execute(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: libraryQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(libraryQueryKeys.materials());

      queryClient.setQueryData<StudyMaterial[]>(libraryQueryKeys.materials(), (old) =>
        old ? old.filter((m) => m.id !== id) : [],
      );

      return { previous };
    },

    onSuccess: () => {
      showToast('Material deleted', { intent: 'success' });
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
