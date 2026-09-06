import { useState, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { useToast } from '../../../app/providers/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { materialQueryKeys } from '../../materials/queries/materialQueryKeys';

export function useCloneShare() {
  const context = useContextOrThrow(ApplicationContext, 'useCloneShare');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [cloningId, setCloningId] = useState<string | null>(null);

  const cloneShare = useCallback(
    async (shareId: string, options?: { passcode?: string; targetSubjectId?: string; targetTermId?: string }) => {
      if (cloningId) return null;
      setCloningId(shareId);
      try {
        const result = await context.useCases.sharing.clonePublishedShare.execute({
          shareId,
          passcode: options?.passcode,
          targetSubjectId: options?.targetSubjectId,
          targetTermId: options?.targetTermId,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() }),
          queryClient.invalidateQueries({ queryKey: ['public-shares'] }),
        ]);

        showToast(`Cloned "${result.share.title}" into library!`, { intent: 'success' });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        showToast(error.message || 'Failed to clone study package', { intent: 'error' });
        throw error;
      } finally {
        setCloningId(null);
      }
    },
    [context, cloningId, queryClient, showToast],
  );

  return {
    cloneShare,
    cloningId,
    isCloning: (shareId: string) => cloningId === shareId,
  };
}
