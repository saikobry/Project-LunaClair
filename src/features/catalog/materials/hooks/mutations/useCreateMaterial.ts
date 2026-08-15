import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../../domain/library';
import type { CreateMaterialInput } from '../../../../../domain/library/LibraryRepository';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useToast } from '../../../../../app/providers/ToastContext';
import { useLibraryRepository } from '../useLibraryRepository';

/**
 * Creates a new study material with optimistic cache update.
 * On mutation start: snapshot → optimistically append → rollback on error.
 * On settle: invalidate to reconcile with server/storage state.
 */
export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const { useCases } = useLibraryRepository();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: CreateMaterialInput) => useCases.library.createMaterial.execute(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: catalogQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(catalogQueryKeys.materials());

      const optimistic: StudyMaterial = {
        id: `temp-${Date.now()}`,
        title: input.title,
        description: input.description,
        documentId: input.documentId ?? `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<StudyMaterial[]>(catalogQueryKeys.materials(), (old) =>
        old ? [...old, optimistic] : [optimistic],
      );

      return { previous };
    },

    onSuccess: (created) => {
      showToast(`Material "${created.title}" created`, { intent: 'success' });
    },

    onError: (_err, _input, context) => {
      showToast('Failed to create study material', { intent: 'error' });
      if (context?.previous) {
        queryClient.setQueryData(catalogQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
    },
  });
}
