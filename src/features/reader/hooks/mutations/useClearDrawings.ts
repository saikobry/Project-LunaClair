import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrawingPath } from '../../../../shared/types/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { useAnnotationRepository } from '../useAnnotationRepository';

/**
 * Clears all drawings for a document with optimistic cache update.
 */
export function useClearDrawings() {
    const queryClient = useQueryClient();
    const annotationRepository = useAnnotationRepository();

    return useMutation({
        mutationFn: (documentId: string) => annotationRepository.clearDrawings(documentId),

        onMutate: async (documentId) => {
            await queryClient.cancelQueries({ queryKey: readerQueryKeys.drawings(documentId) });
            const previous = queryClient.getQueryData<DrawingPath[]>(readerQueryKeys.drawings(documentId));

            queryClient.setQueryData<DrawingPath[]>(readerQueryKeys.drawings(documentId), []);

            return { previous };
        },

        onError: (_err, documentId, context) => {
            if (context?.previous) {
                queryClient.setQueryData(readerQueryKeys.drawings(documentId), context.previous);
            }
        },

        onSettled: (_data, _err, documentId) => {
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.drawings(documentId) });
        },
    });
}
