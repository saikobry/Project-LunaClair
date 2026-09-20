import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAiModelCatalog } from '../useAiModelCatalog';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../../../../app/providers/ApplicationContext';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../../domain/ai/services/aiModelCatalog';

const MAX_ID = 'ukisai-swift-max';

/** The catalog the server would serve with MAX removed, i.e. after the kill switch was set. */
const WITHOUT_MAX: AiModelCatalog = {
  ...DEFAULT_AI_MODEL_CATALOG,
  version: '2099-01-01.1',
  models: DEFAULT_AI_MODEL_CATALOG.models.filter((model) => model.id !== MAX_ID),
};

/**
 * A wrapper with one QueryClient — the shared cache the hook reads — and optionally a catalog use
 * case. Mounting two hooks against the same client is how the sharing contract is exercised.
 */
function createWrapper(getCatalog?: () => Promise<AiModelCatalog>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const contextValue = {
    useCases: { ai: getCatalog ? { getModelCatalog: { execute: getCatalog } } : {} },
  } as unknown as ApplicationContextValue;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, queryClient };
}

describe('useAiModelCatalog', () => {
  it('answers from the bundled mirror before any fetch resolves', () => {
    const { wrapper } = createWrapper(async () => DEFAULT_AI_MODEL_CATALOG);

    const { result } = renderHook(() => useAiModelCatalog(), { wrapper });

    // Offline-first: the picker must render without a network, so the first render already has data.
    expect(result.current.catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('asks the server on mount despite already having the mirror', async () => {
    const execute = vi.fn(async () => WITHOUT_MAX);
    const { wrapper } = createWrapper(execute);

    const { result } = renderHook(() => useAiModelCatalog(), { wrapper });

    // The mirror is initialData marked stale; if it were treated as fresh, this fetch would never fire.
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.catalog).toEqual(WITHOUT_MAX));
  });

  it('serves one fetch to every consumer', async () => {
    const execute = vi.fn(async () => WITHOUT_MAX);
    const { wrapper } = createWrapper(execute);

    const first = renderHook(() => useAiModelCatalog(), { wrapper });
    const second = renderHook(() => useAiModelCatalog(), { wrapper });

    await waitFor(() => expect(first.result.current.catalog).toEqual(WITHOUT_MAX));
    await waitFor(() => expect(second.result.current.catalog).toEqual(WITHOUT_MAX));

    // This is the point of shared cache state: two surfaces cannot disagree about which models exist,
    // because there is one entry and one request behind them.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('refreshes every consumer at once when the catalog is invalidated', async () => {
    const execute = vi
      .fn<() => Promise<AiModelCatalog>>()
      .mockResolvedValueOnce(DEFAULT_AI_MODEL_CATALOG)
      .mockResolvedValue(WITHOUT_MAX);
    const { wrapper } = createWrapper(execute);

    const { result } = renderHook(() => useAiModelCatalog(), { wrapper });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.refreshCatalog();
    });

    await waitFor(() => {
      expect(result.current.catalog.models.map((model) => model.id)).not.toContain(MAX_ID);
    });
  });

  it('keeps the mirror when the catalog use case is absent', () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAiModelCatalog(), { wrapper });

    expect(result.current.catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('keeps the mirror when the fetch fails', async () => {
    const { wrapper } = createWrapper(async () => {
      throw new Error('offline');
    });

    const { result } = renderHook(() => useAiModelCatalog(), { wrapper });

    await waitFor(() => expect(result.current.catalog).toEqual(DEFAULT_AI_MODEL_CATALOG));
  });
});
