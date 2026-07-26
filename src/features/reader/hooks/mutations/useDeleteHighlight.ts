import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HighlightItem } from '../../../../shared/types/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { useAnnotationRepository } from '../useAnnotationRepository';

interface DeleteHighlightVariables {
    documentId: string;
    highlightId: string;
}

/**
 * Deletes a single highlight by ID with optimistic cache removal.
 * Persists the updated array via the annotation repository.
 */
export function useDeleteHighlight() {
    const queryClient = useQueryClient();
    const annotationRepository = useAnnotationRepository();

    return useMutation({
        mutationFn: async ({ documentId, highlightId }: DeleteHighlightVariables) => {
            const current = queryClient.getQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId)) ?? [];
            const updated = current.filter((h) => h.id !== highlightId);
            await annotationRepository.saveHighlights(documentId, updated);
            return updated;
        },

        onMutate: async ({ documentId, highlightId }) => {
            await queryClient.cancelQueries({ queryKey: readerQueryKeys.highlights(documentId) });
            const previous = queryClient.getQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId));

            queryClient.setQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId), (old) =>
                old ? old.filter((h) => h.id !== highlightId) : [],
            );

            return { previous };
        },

        onError: (_err, { documentId }, context) => {
            if (context?.previous) {
                queryClient.setQueryData(readerQueryKeys.highlights(documentId), context.previous);
            }
        },

        onSettled: (_data, _err, { documentId }) => {
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.highlights(documentId) });
        },
    });
}
