import { useCallback, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../domain/ai/services/aiModelCatalog';
import { aiQueryKeys } from '../../queries/aiQueryKeys';

export interface AiModelCatalogState {
  /** Best-known catalog: the served one when a fetch succeeded, otherwise the bundled mirror. */
  catalog: AiModelCatalog;
  /** Drops the cached catalog and fetches it again, for every consumer at once. */
  refreshCatalog: () => void;
}

/**
 * The AI model catalog, as **shared cache state** rather than per-component state.
 *
 * Every consumer of this hook reads one `['ai','model-catalog']` entry, so two surfaces can never
 * disagree about which models exist, and `refreshCatalog` corrects all of them by invalidating that
 * key instead of asking each caller to re-run its own effect. The repository underneath already
 * merges a live fetch, a dated cache, and the bundle, so this hook stays a thin query over it.
 *
 * The bundled mirror is `initialData`, which is what keeps the offline-first contract: the picker
 * renders before (and without) the network. It is deliberately marked **already stale**
 * (`initialDataUpdatedAt: 0`), because otherwise TanStack would treat it as freshly fetched data and
 * skip the mount fetch entirely.
 */
export function useAiModelCatalog(): AiModelCatalogState {
  const context = useContext(ApplicationContext);
  const getModelCatalog = context?.useCases?.ai?.getModelCatalog;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: aiQueryKeys.modelCatalog(),
    queryFn: () => getModelCatalog?.execute() ?? Promise.resolve(DEFAULT_AI_MODEL_CATALOG),
    initialData: DEFAULT_AI_MODEL_CATALOG,
    initialDataUpdatedAt: 0,
    // Without the use case there is nothing to ask; the mirror is the whole answer.
    enabled: Boolean(getModelCatalog),
  });

  const refreshCatalog = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: aiQueryKeys.modelCatalog() });
  }, [queryClient]);

  return { catalog: data ?? DEFAULT_AI_MODEL_CATALOG, refreshCatalog };
}
