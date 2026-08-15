import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../../../materials/hooks/useLibraryRepository';
import type { ImportSubjectResult } from '../../../../../application';

/**
 * Imports an entire subject and its unimported study materials from the remote
 * catalog into the local library.
 * On success the local library, subjects, and available catalog caches are
 * invalidated so imported materials appear in "My Library" and their
 * availability states update in "Available Materials".
 */
export function useImportSubject() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation<ImportSubjectResult, Error, string>({
    mutationFn: (subjectId: string) =>
      useCases.library.importSubject.execute(subjectId),

    onSuccess: (result) => {
      if (result.importedCount > 0) {
        showToast(
          `Added ${result.importedCount} ${result.importedCount === 1 ? 'material' : 'materials'} from ${result.subjectTitle} to your library`,
          { intent: 'success' },
        );
      } else if (result.alreadyImportedCount === result.totalMaterials && result.totalMaterials > 0) {
        showToast(`${result.subjectTitle} is already in your library`, { intent: 'info' });
      }

      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subjects() });
      void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.catalog() });
    },

    onError: (error) => {
      showToast(error.message || 'Failed to import subject materials', { intent: 'error' });
    },
  });
}
