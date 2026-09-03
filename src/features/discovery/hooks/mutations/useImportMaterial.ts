import { useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryQueryKeys } from '../../queries/discoveryQueryKeys';
import { materialQueryKeys } from '../../../materials/queries/materialQueryKeys';
import { subjectQueryKeys } from '../../../subjects/queries/subjectQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../../../materials/hooks/useLibraryRepository';

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
      void queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
      void queryClient.invalidateQueries({ queryKey: subjectQueryKeys.subjects() });
      void queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.catalog() });
    },
  });
}
