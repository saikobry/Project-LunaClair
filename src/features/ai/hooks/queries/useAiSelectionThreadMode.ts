import { useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { AiSelectionThreadMode } from '../../../../domain/ai/models/ai.types';
import { aiQueryKeys } from '../../queries/aiQueryKeys';

/**
 * Shared query and mutation hook for the reader-selection thread-mode preference.
 *
 * Mirrors `useAiGroundingDefault`: the repository is the read path, the
 * `SetSelectionThreadModeUseCase` is the write path, and the settled mutation
 * writes straight into the shared cache entry so every consumer (drawer,
 * settings) observes the same value without refetching.
 */
export function useAiSelectionThreadMode() {
  const context = useContext(ApplicationContext);
  const preferencesRepo = context?.repositories?.preferences;
  const setSelectionThreadModeUseCase = context?.useCases?.ai?.setSelectionThreadMode;
  const queryClient = useQueryClient();

  const query = useQuery<AiSelectionThreadMode>({
    queryKey: aiQueryKeys.selectionThreadMode(),
    queryFn: async () => {
      if (!preferencesRepo) return 'latest';
      return preferencesRepo.getAiSelectionThreadMode();
    },
    enabled: Boolean(preferencesRepo),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  });

  const mutation = useMutation({
    mutationFn: async (mode: AiSelectionThreadMode) => {
      if (!setSelectionThreadModeUseCase) {
        throw new Error('SetSelectionThreadModeUseCase is unavailable');
      }
      await setSelectionThreadModeUseCase.execute(mode);
    },
    onSuccess: (_, mode) => {
      queryClient.setQueryData(aiQueryKeys.selectionThreadMode(), mode);
    },
  });

  return {
    threadMode: query.data ?? 'latest',
    isLoading: query.isLoading,
    setThreadMode: mutation.mutateAsync,
  };
}
