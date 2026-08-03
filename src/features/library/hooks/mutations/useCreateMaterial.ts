import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library';
import type { CreateMaterialInput } from '../../../../domain/library/LibraryRepository';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Creates a new study material with optimistic cache update.
 * On mutation start: snapshot → optimistically append → rollback on error.
 * On settle: invalidate to reconcile with server/storage state.
 */
export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();

  return useMutation({
    mutationFn: (input: CreateMaterialInput) => useCases.library.createMaterial.execute(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: libraryQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(libraryQueryKeys.materials());

      const optimistic: StudyMaterial = {
        id: `temp-${Date.now()}`,
        title: input.title,
        description: input.description,
        sourceType: input.sourceType ?? 'bundled',
        sourceId: input.sourceId ?? `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<StudyMaterial[]>(libraryQueryKeys.materials(), (old) =>
        old ? [...old, optimistic] : [optimistic],
      );

      return { previous };
    },

    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.materials() });
    },
  });
}
