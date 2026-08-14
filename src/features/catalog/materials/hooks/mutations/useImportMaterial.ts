import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Imports one material from the remote catalog into the local library.
 * On success the local library + available catalog caches are invalidated so
 * the imported material appears in "My Library" and its availability state
 * updates in "Available Materials".
 */
export function useImportMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (materialId: string) =>
      useCases.library.importMaterial.execute(materialId),

    onSuccess: () => {
      showToast('Material added to your library', { intent: 'success' });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subjects() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.catalog() });
    },
  });
}
