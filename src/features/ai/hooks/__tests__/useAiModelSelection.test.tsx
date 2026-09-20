import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAiModelSelection } from '../useAiModelSelection';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../../../app/providers/ApplicationContext';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../domain/ai/services/aiModelCatalog';

const DEFAULT_ID = DEFAULT_AI_MODEL_CATALOG.defaultModelId;
const MAX_ID = 'ukisai-swift-max';

/** A wrapper whose only capability is the catalog use case under test. */
function wrapperWith(getCatalog?: () => Promise<AiModelCatalog>) {
  const contextValue = {
    useCases: { ai: getCatalog ? { getModelCatalog: { execute: getCatalog } } : {} },
  } as unknown as ApplicationContextValue;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );
}

describe('useAiModelSelection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('offers the bundled mirror before any catalog is fetched', () => {
    const { result } = renderHook(() => useAiModelSelection(), { wrapper: wrapperWith() });

    expect(result.current.catalog.models.length).toBeGreaterThan(1);
    expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
  });

  it('adopts the fetched catalog', async () => {
    const fetched: AiModelCatalog = {
      ...DEFAULT_AI_MODEL_CATALOG,
      version: '2099-01-01.1',
      models: [DEFAULT_AI_MODEL_CATALOG.models[0]],
      defaultModelId: DEFAULT_ID,
    };

    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(async () => fetched),
    });

    await waitFor(() => {
      expect(result.current.catalog.version).toBe('2099-01-01.1');
    });
    expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
  });

  it('keeps the bundled mirror when the catalog fetch fails', async () => {
    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(async () => {
        throw new Error('offline');
      }),
    });

    await waitFor(() => {
      expect(result.current.catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
    });
    expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
  });

  it('remembers a chosen model on the device', () => {
    const { result } = renderHook(() => useAiModelSelection(), { wrapper: wrapperWith() });

    act(() => {
      result.current.selectModel(MAX_ID);
    });

    expect(result.current.selectedModel?.id).toBe(MAX_ID);
    expect(localStorage.getItem(STORAGE_KEYS.ai.modelId)).toBe(MAX_ID);
  });

  it('restores a remembered choice on the next mount', () => {
    localStorage.setItem(STORAGE_KEYS.ai.modelId, MAX_ID);

    const { result } = renderHook(() => useAiModelSelection(), { wrapper: wrapperWith() });

    expect(result.current.selectedModel?.id).toBe(MAX_ID);
  });

  it('re-reads the catalog on refresh, so a refused model stops being offered', async () => {
    const withoutMax: AiModelCatalog = {
      ...DEFAULT_AI_MODEL_CATALOG,
      version: '2099-01-01.1',
      models: [DEFAULT_AI_MODEL_CATALOG.models[0]],
    };
    const execute = vi
      .fn<() => Promise<AiModelCatalog>>()
      .mockResolvedValueOnce(DEFAULT_AI_MODEL_CATALOG)
      .mockResolvedValue(withoutMax);

    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(execute),
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.refreshCatalog();
    });

    await waitFor(() => {
      expect(result.current.catalog.models.map((model) => model.id)).toEqual([DEFAULT_ID]);
    });
  });

  it('resolves a retired or unknown preference to the catalog default', () => {
    // A model can leave the catalog; the stored id must never be sent as-is.
    localStorage.setItem(STORAGE_KEYS.ai.modelId, 'model-that-was-removed');

    const { result } = renderHook(() => useAiModelSelection(), { wrapper: wrapperWith() });

    expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
  });

  it('resolves to no selection at all when the assistant is switched off', async () => {
    const off: AiModelCatalog = {
      version: '2099-01-01.1',
      availability: 'disabled',
      defaultModelId: null,
      models: [],
    };

    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(async () => off),
    });
    await waitFor(() => expect(result.current.isAiDisabled).toBe(true));

    // Nothing is sent and nothing is substituted: the drawer blocks on this rather than choosing a
    // model for the user.
    expect(result.current.selectedModel).toBeNull();
  });

  it('survives storage that refuses to write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useAiModelSelection(), { wrapper: wrapperWith() });
    act(() => {
      result.current.selectModel(MAX_ID);
    });

    // The choice still applies to this session even if it cannot be persisted.
    expect(result.current.selectedModel?.id).toBe(MAX_ID);
    setItem.mockRestore();
  });
});
