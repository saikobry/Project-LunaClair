import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
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
      await queryClient.cancelQueries({ queryKey: catalogQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(catalogQueryKeys.materials());

      queryClient.setQueryData<StudyMaterial[]>(catalogQueryKeys.materials(), (old) =>
        old ? old.filter((m) => m.id !== id) : [],
      );

      return { previous };
    },

    onSuccess: () => {
      showToast('Material deleted', { intent: 'success' });
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(catalogQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
    },
  });
}
