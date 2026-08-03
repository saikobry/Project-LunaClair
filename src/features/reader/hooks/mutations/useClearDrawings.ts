import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrawingPath } from '../../../../shared/types/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { useAnnotationRepository } from '../useAnnotationRepository';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Clears all drawings for a document with optimistic cache update.
 */
export function useClearDrawings() {
    const queryClient = useQueryClient();
    useAnnotationRepository();
    const context = useContextOrThrow(ApplicationContext, 'useClearDrawings');

    return useMutation({
        mutationFn: (documentId: string) => context.useCases.reader.clearAnnotations.execute(documentId, 'drawings'),

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
