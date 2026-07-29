import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

/**
 * Mutation hook for deleting a subject.
 *
 * Also unassigns all materials that belonged to the deleted subject
 * by setting their `subjectId` to `undefined`.
 *
 * On success: shows a confirmation toast and invalidates both subjects
 * and materials queries.
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(RepositoryContext, 'useDeleteSubject');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (subjectId: string) => {
      // 1. Unassign all materials that belong to this subject
      const materials = await context.libraryRepository.getMaterials();
      const subjectMaterials = materials.filter((m) => m.subjectId === subjectId);

      await Promise.all(
        subjectMaterials.map((m) =>
          context.libraryRepository.updateMaterial(m.id, { subjectId: null }),
        ),
      );

      // 2. Delete the subject itself
      await context.subjectRepository.deleteSubject(subjectId);
    },

    onSuccess: () => {
      showToast('Subject deleted', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
