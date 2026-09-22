import { useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { aiQueryKeys } from '../../queries/aiQueryKeys';

/**
 * Shared query and mutation hook for the preferred AI model preference.
 *
 * Mirrors `useAiGroundingDefault`: the repository is the read path, the
 * `SetPreferredModelIdUseCase` is the write path, and the settled mutation
 * writes straight into the shared cache entry so every consumer (drawer,
 * settings) observes the same value without refetching. `null` means no
 * stored choice — catalog resolution then falls back to the default model.
 */
export function usePreferredModelId() {
  const context = useContext(ApplicationContext);
  const preferencesRepo = context?.repositories?.preferences;
  const setPreferredModelIdUseCase = context?.useCases?.ai?.setPreferredModelId;
  const queryClient = useQueryClient();

  const query = useQuery<string | null>({
    queryKey: aiQueryKeys.preferredModel(),
    queryFn: async () => {
      if (!preferencesRepo) return null;
      return preferencesRepo.getPreferredModelId();
    },
    enabled: Boolean(preferencesRepo),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  });

  const mutation = useMutation({
    mutationFn: async (modelId: string) => {
      if (!setPreferredModelIdUseCase) {
        throw new Error('SetPreferredModelIdUseCase is unavailable');
      }
      await setPreferredModelIdUseCase.execute(modelId);
    },
    onSuccess: (_, modelId) => {
      queryClient.setQueryData(aiQueryKeys.preferredModel(), modelId);
    },
  });

  return {
    preferredModelId: query.data ?? null,
    isLoading: query.isLoading,
    setPreferredModelId: mutation.mutateAsync,
  };
}
