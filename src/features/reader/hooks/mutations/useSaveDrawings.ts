import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrawingPath } from '../../../../domain/reader/models/annotation.types';
import { readerQueryKeys } from '../../queries/readerQueryKeys';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

interface SaveDrawingsVariables {
    documentId: string;
    paths: DrawingPath[];
}

/**
 * Saves the full drawing paths array for a document.
 * Optimistically updates the cache and reconciles on settle.
 */
export function useSaveDrawings() {
    const queryClient = useQueryClient();
    const context = useContextOrThrow(ApplicationContext, 'useSaveDrawings');

    return useMutation({
        mutationFn: ({ documentId, paths }: SaveDrawingsVariables) =>
            context.useCases.reader.saveDrawing.execute(documentId, paths),

        onMutate: async ({ documentId, paths }) => {
            await queryClient.cancelQueries({ queryKey: readerQueryKeys.drawings(documentId) });
            const previous = queryClient.getQueryData<DrawingPath[]>(readerQueryKeys.drawings(documentId));

            queryClient.setQueryData<DrawingPath[]>(readerQueryKeys.drawings(documentId), paths);

            return { previous };
        },

        onError: (_err, { documentId }, context) => {
            if (context?.previous) {
                queryClient.setQueryData(readerQueryKeys.drawings(documentId), context.previous);
            }
        },

        onSettled: (_data, _err, { documentId }) => {
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.drawings(documentId) });
        },
    });
}
