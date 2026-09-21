import { useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { AiGroundingMode } from '../../../../domain/ai/models/ai.types';
import { aiQueryKeys } from '../../queries/aiQueryKeys';

/**
 * Shared query and mutation hook for the new-conversation grounding default preference.
 */
export function useAiGroundingDefault() {
  const context = useContext(ApplicationContext);
  const preferencesRepo = context?.repositories?.preferences;
  const setGroundingDefaultUseCase = context?.useCases?.ai?.setGroundingDefault;
  const queryClient = useQueryClient();

  const query = useQuery<AiGroundingMode>({
    queryKey: aiQueryKeys.groundingDefault(),
    queryFn: async () => {
      if (!preferencesRepo) return 'whole';
      return preferencesRepo.getAiGroundingDefault();
    },
    enabled: Boolean(preferencesRepo),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  });

  const mutation = useMutation({
    mutationFn: async (mode: AiGroundingMode) => {
      if (!setGroundingDefaultUseCase) {
        throw new Error('SetGroundingDefaultUseCase is unavailable');
      }
      await setGroundingDefaultUseCase.execute(mode);
    },
    onSuccess: (_, mode) => {
      queryClient.setQueryData(aiQueryKeys.groundingDefault(), mode);
    },
  });

  return {
    defaultMode: query.data ?? 'whole',
    isLoading: query.isLoading,
    setDefaultMode: mutation.mutateAsync,
  };
}
