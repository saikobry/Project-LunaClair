import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { CreateMaterialInput } from '../../../../domain/library/repositories/LibraryRepository';
import { materialQueryKeys } from '../../queries/materialQueryKeys';
import { useToast } from '../../../../app/providers/ToastContext';
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
      await queryClient.cancelQueries({ queryKey: materialQueryKeys.materials() });
      const previous = queryClient.getQueryData<StudyMaterial[]>(materialQueryKeys.materials());

      const optimistic: StudyMaterial = {
        id: `temp-${Date.now()}`,
        title: input.title,
        description: input.description,
        documentId: input.documentId ?? `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<StudyMaterial[]>(materialQueryKeys.materials(), (old) =>
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
        queryClient.setQueryData(materialQueryKeys.materials(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
    },
  });
}
