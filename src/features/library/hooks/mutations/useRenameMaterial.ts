import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library';
import type { UpdateMaterialInput } from '../../../../domain/library/LibraryRepository';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { useLibraryRepository } from '../useLibraryRepository';

interface RenameVariables {
  id: string;
  input: UpdateMaterialInput;
}

/**
 * Renames / updates a study material with optimistic cache update.
 * On mutation start: snapshot → optimistically apply → rollback on error.
 * On settle: invalidate to reconcile.
 */
export function useRenameMaterial() {
  const queryClient = useQueryClient();
  const { libraryRepository } = useLibraryRepository();

  return useMutation({
    mutationFn: ({ id, input }: RenameVariables) => libraryRepository.updateMaterial(id, input),

    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: libraryQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(libraryQueryKeys.materials());

      queryClient.setQueryData<StudyMaterial[]>(libraryQueryKeys.materials(), (old) =>
        old
          ? old.map((m) =>
              m.id === id
                ? { ...m, ...input, updatedAt: new Date().toISOString() }
                : m,
            )
          : [],
      );

      return { previous };
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
