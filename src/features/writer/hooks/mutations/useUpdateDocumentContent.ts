import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { useToast } from '../../../../app/providers/ToastContext';
import { readerQueryKeys } from '../../../reader/queries/readerQueryKeys';

export interface UpdateDocumentContentVariables {
  materialId: string;
  documentId: string;
  title: string;
  content: string;
}

/**
 * Mutation hook for updating document content (markdown) in Dexie.
 *
 * Delegates persistence directly to `context.useCases.content.updateDocumentContent`.
 * On success, invalidates the reader query cache so Reader immediately
 * reflects the new content, and surfaces a success toast.
 */
export function useUpdateDocumentContent() {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useUpdateDocumentContent');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ documentId, title, content }: UpdateDocumentContentVariables) => {
      return context.useCases.content.updateDocumentContent.execute({
        documentId,
        title,
        content,
      });
    },

    onSuccess: (_data, { materialId, documentId }) => {
      // Invalidate reader cache for both materialId and documentId
      queryClient.invalidateQueries({ queryKey: readerQueryKeys.document(materialId) });
      if (documentId !== materialId) {
        queryClient.invalidateQueries({ queryKey: readerQueryKeys.document(documentId) });
      }
      showToast('Changes saved to local library', { intent: 'success' });
    },

    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : 'Failed to save document changes',
        { intent: 'error' },
      );
    },
  });
}
