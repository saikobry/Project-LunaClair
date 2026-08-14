import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Removes one material from the local library (local-only — the canonical D1
 * catalog entry is untouched and the material remains available for re-import).
 * Invalidates the local library + available catalog caches on success.
 */
export function useRemoveImportedMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (materialId: string) =>
      useCases.library.removeImportedMaterial.execute(materialId),

    onSuccess: () => {
      showToast('Material removed from your library', { intent: 'info' });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subjects() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.catalog() });
    },
  });
}
