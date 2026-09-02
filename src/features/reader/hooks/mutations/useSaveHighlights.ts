import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HighlightItem } from '../../../../domain/reader/models/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

interface SaveHighlightVariables {
    documentId: string;
    highlights: HighlightItem[];
}

/**
 * Saves the full highlights array for a document.
 * Optimistically updates the cache and reconciles on settle.
 */
export function useSaveHighlights() {
    const queryClient = useQueryClient();
    const context = useContextOrThrow(ApplicationContext, 'useSaveHighlights');

    return useMutation({
        mutationFn: ({ documentId, highlights }: SaveHighlightVariables) =>
            context.useCases.reader.saveHighlight.execute(documentId, highlights),

        onMutate: async ({ documentId, highlights }) => {
            await queryClient.cancelQueries({ queryKey: readerQueryKeys.highlights(documentId) });
            const previous = queryClient.getQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId));

            queryClient.setQueryData<HighlightItem[]>(readerQueryKeys.highlights(documentId), highlights);

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
