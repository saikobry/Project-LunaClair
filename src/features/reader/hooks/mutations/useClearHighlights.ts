import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HighlightItem } from '../../../../domain/reader';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { useAnnotationRepository } from '../useAnnotationRepository';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Clears all highlights for a document with optimistic cache update.
 */
export function useClearHighlights() {
    const queryClient = useQueryClient();
    useAnnotationRepository();
    const context = useContextOrThrow(ApplicationContext, 'useClearHighlights');

    return useMutation({
        mutationFn: (documentId: string) => context.useCases.reader.clearAnnotations.execute(documentId, 'highlights'),

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
