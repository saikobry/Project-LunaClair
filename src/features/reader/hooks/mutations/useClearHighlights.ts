import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HighlightItem } from '../../../../shared/types/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { useAnnotationRepository } from '../useAnnotationRepository';

/**
 * Clears all highlights for a document with optimistic cache update.
 */
export function useClearHighlights() {
    const queryClient = useQueryClient();
    const annotationRepository = useAnnotationRepository();

    return useMutation({
        mutationFn: (documentId: string) => annotationRepository.clearHighlights(documentId),

        onMutate: async (documentId) => {
            await queryClient.cancelQueries({ queryKey: readerQueryKeys.highlights(documentId) });
            const previous = queryClient.getQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId));

            queryClient.setQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId), []);

            return { previous };
        },

        onError: (_err, documentId, context) => {
            if (context?.previous) {
                queryClient.setQueryData(readerQueryKeys.highlights(documentId), context.previous);
            }
        },

        onSettled: (_data, _err, documentId) => {
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.highlights(documentId) });
        },
    });
}
