import { useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryQueryKeys } from '../../queries/discoveryQueryKeys';
import { materialQueryKeys } from '../../../materials/queries/materialQueryKeys';
import { subjectQueryKeys } from '../../../subjects/queries/subjectQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../../../materials/hooks/useLibraryRepository';

/**
 * Removes one imported material from the local library.
 * On success the local library + available catalog caches are invalidated so
 * the removed material disappears from "My Library" and is re-enabled for import
 * in "Available Materials".
 */
export function useRemoveImportedMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (materialId: string) =>
      useCases.library.removeImportedMaterial.execute(materialId),

    onSuccess: () => {
      showToast('Material removed from your library', { intent: 'success' });
      void queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
      void queryClient.invalidateQueries({ queryKey: subjectQueryKeys.subjects() });
      void queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.catalog() });
    },
  });
}
