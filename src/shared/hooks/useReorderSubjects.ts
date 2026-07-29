import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import type { Subject } from '../../domain/library';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { useToast } from '../../app/providers/ToastContext';
import { useContextOrThrow } from '../utils/contextGuard';

interface ReorderVariables {
  /** The ID of the subject being dragged. */
  subjectId: string;
  /** The target index in the sorted list where the subject should land. */
  targetIndex: number;
}

/**
 * Mutation hook for drag-and-drop subject reordering.
 *
 * Takes a subject ID and a target index in the current sorted list,
 * recomputes sequential `order` values for all subjects, and batch-updates
 * only the subjects whose order actually changed.
 */
export function useReorderSubjects() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(RepositoryContext, 'useReorderSubjects');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ subjectId, targetIndex }: ReorderVariables) => {
      const data = queryClient.getQueryData<Subject[]>([...libraryQueryKeys.root, 'subjects']);
      if (!data) return;

      // Sort the same way useSubjects does
      const sorted = [...data].sort(
        (a, b) =>
          (a.order ?? 999) - (b.order ?? 999) ||
          a.title.localeCompare(b.title),
      );

      const sourceIndex = sorted.findIndex((s) => s.id === subjectId);
      if (sourceIndex === -1 || sourceIndex === targetIndex) return;

      // Clamp targetIndex to valid range
      const clampedTarget = Math.max(0, Math.min(targetIndex, sorted.length - 1));

      // Reorder the array in memory
      const [removed] = sorted.splice(sourceIndex, 1);
      sorted.splice(clampedTarget, 0, removed);

      // Assign sequential order values and collect updates
      const updates: { id: string; order: number }[] = [];
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].order !== i) {
          updates.push({ id: sorted[i].id, order: i });
        }
      }

      // Batch-update only the subjects whose order changed
      if (updates.length > 0) {
        await Promise.all(
          updates.map((u) =>
            context.subjectRepository.updateSubject(u.id, { order: u.order }),
          ),
        );
      }
    },

    onSuccess: () => {
      showToast('Subject reordered', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.subjects() });
    },
  });
}
