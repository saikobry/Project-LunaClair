import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { materialQueryKeys } from '../../queries/materialQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Removes one material from the local library with optimistic cache removal.
 *
 * Delegates to the atomic cascade removal, which is the **only** removal path: one transaction clears
 * the material row along with its questions, quizzes, document content, collection membership, and
 * stored binary assets. There is deliberately no row-only delete to fall back to — see
 * `LibraryRepository`.
 *
 * On mutation start: snapshot → optimistically filter out → rollback on error.
 * On success: show confirmation toast.
 * On settle: reconcile every cache the cascade can have touched.
 */
export function useRemoveMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => useCases.library.removeMaterial.execute(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: materialQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(materialQueryKeys.materials());

      queryClient.setQueryData<StudyMaterial[]>(materialQueryKeys.materials(), (old) =>
        old ? old.filter((m) => m.id !== id) : [],
      );

      return { previous };
    },

    onSuccess: () => {
      showToast('Removed from your library', { intent: 'success' });
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(materialQueryKeys.materials(), context.previous);
      }
    },

    onSettled: (_data, _error, id) => {
      // The cascade reaches further than the materials store, so reconcile everything it can have
      // emptied: the library lists, the material's authored question/quiz content, any cached
      // assessment built on it, collection membership (its junction rows are cleared too), and the
      // analytics derived from its sessions. Prefix keys rather than another feature's key factory —
      // importing `collections`/`analytics` internals here would cross a feature boundary.
      queryClient.invalidateQueries({ queryKey: materialQueryKeys.all });
      // The detail key is a *sibling* namespace, not a child of `materialQueryKeys.all`:
      // `['library','material',id]` vs `['library','materials']`. TanStack matching is segment-wise,
      // so the list invalidation above never reaches it — without this line a removed material stays
      // warm in the detail cache and can still render.
      queryClient.invalidateQueries({ queryKey: materialQueryKeys.material(id) });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['assessment'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
