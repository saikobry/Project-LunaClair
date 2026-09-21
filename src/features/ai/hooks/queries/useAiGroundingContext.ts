import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { AiGroundingTarget } from '../../../../application/use-cases/ai/AiGroundingResolver';
import type { AiGroundingContextSummary } from '../../../../application/use-cases/ai/GetAiGroundingContextUseCase';
import { aiQueryKeys } from '../../queries/aiQueryKeys';

export interface UseAiGroundingContextOptions {
  model?: string;
  enabled?: boolean;
}

/**
 * Shared query hook for estimating next-request document grounding characters and mode.
 *
 * Reads from GetAiGroundingContextUseCase, which shares the exact same AiGroundingResolver
 * that SendChatMessageUseCase uses.
 */
export function useAiGroundingContext(
  target: AiGroundingTarget | null,
  options: UseAiGroundingContextOptions = {},
) {
  const context = useContext(ApplicationContext);
  const getGroundingContext = context?.useCases?.ai?.getGroundingContext;

  const targetKey: AiGroundingTarget = target ?? { materialId: undefined, grounding: 'none' };

  return useQuery<AiGroundingContextSummary>({
    queryKey: aiQueryKeys.groundingContext(targetKey, options.model),
    queryFn: async ({ signal }) => {
      if (!getGroundingContext || !target) {
        return { mode: 'none', documentCharacters: 0 };
      }
      return getGroundingContext.execute(target, {
        model: options.model,
        signal,
      });
    },
    enabled: (options.enabled ?? true) && Boolean(getGroundingContext) && Boolean(target),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });
}
