import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library';
import type { UpdateMaterialInput } from '../../../../domain/library/LibraryRepository';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

interface EditVariables {
  id: string;
  input: UpdateMaterialInput;
}

/**
 * Edits / updates a study material with optimistic cache update.
 * On mutation start: snapshot → optimistically apply → rollback on error.
 * On success: show confirmation toast.
 * On settle: invalidate to reconcile.
 */
export function useEditMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: EditVariables) => useCases.library.updateMaterial.execute(id, input),

    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: libraryQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(libraryQueryKeys.materials());

      // Convert null to undefined for subjectId/termId to match StudyMaterial type
      const { subjectId, termId, ...rest } = input;
      const sanitizedInput: Partial<StudyMaterial> = {
        ...rest,
        ...(subjectId !== undefined ? { subjectId: subjectId ?? undefined } : {}),
        ...(termId !== undefined ? { termId: termId ?? undefined } : {}),
      };

      queryClient.setQueryData<StudyMaterial[]>(libraryQueryKeys.materials(), (old) =>
        old
          ? old.map((m) =>
              m.id === id
                ? { ...m, ...sanitizedInput, updatedAt: new Date().toISOString() }
                : m,
            )
          : [],
      );

      return { previous };
    },

    onSuccess: () => {
      showToast('Material updated', { intent: 'success' });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
