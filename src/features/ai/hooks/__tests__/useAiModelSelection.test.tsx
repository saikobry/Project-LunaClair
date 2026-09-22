import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAiModelSelection } from '../useAiModelSelection';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../../../app/providers/ApplicationContext';
import type { PreferencesRepository } from '../../../../domain/preferences/repositories/PreferencesRepository';
import { SetPreferredModelIdUseCase } from '../../../../application/use-cases/ai/SetPreferredModelIdUseCase';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../domain/ai/services/aiModelCatalog';

const DEFAULT_ID = DEFAULT_AI_MODEL_CATALOG.defaultModelId;
const MAX_ID = 'ukisai-swift-max';

/** A wrapper with the catalog use case plus a real preferences graph under test. */
function wrapperWith(
  getCatalog?: () => Promise<AiModelCatalog>,
  preferencesRepo?: PreferencesRepository,
) {
  const preferences = preferencesRepo ?? new InMemoryPreferencesRepository();
  const contextValue = {
    repositories: { preferences },
    useCases: {
      ai: {
        ...(getCatalog ? { getModelCatalog: { execute: getCatalog } } : {}),
        setPreferredModelId: new SetPreferredModelIdUseCase(preferences),
      },
    },
  } as unknown as ApplicationContextValue;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );
}

describe('useAiModelSelection', () => {
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

  it('remembers a chosen model on the device', async () => {
    const preferences = new InMemoryPreferencesRepository();
    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(undefined, preferences),
    });

    act(() => {
      result.current.selectModel(MAX_ID);
    });

    await waitFor(() => {
      expect(result.current.selectedModel?.id).toBe(MAX_ID);
    });
    expect(await preferences.getPreferredModelId()).toBe(MAX_ID);
  });

  it('restores a remembered choice on the next mount', async () => {
    const preferences = new InMemoryPreferencesRepository();
    await preferences.setPreferredModelId(MAX_ID);

    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(undefined, preferences),
    });

    await waitFor(() => {
      expect(result.current.selectedModel?.id).toBe(MAX_ID);
    });
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

  it('resolves a retired or unknown preference to the catalog default', async () => {
    // A model can leave the catalog; the stored id must never be sent as-is.
    const preferences = new InMemoryPreferencesRepository();
    await preferences.setPreferredModelId('model-that-was-removed');

    const { result } = renderHook(() => useAiModelSelection(), {
      wrapper: wrapperWith(undefined, preferences),
    });

    await waitFor(() => {
      expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
    });
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

  it('degrades to the catalog default when the preference cannot be persisted', async () => {
    const failingRepo = {
      getPreferredModelId: async () => null,
      setPreferredModelId: async () => {
        throw new Error('quota exceeded');
      },
    } as unknown as PreferencesRepository;
    const contextValue = {
      repositories: { preferences: failingRepo },
      useCases: { ai: { setPreferredModelId: new SetPreferredModelIdUseCase(failingRepo) } },
    } as unknown as ApplicationContextValue;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAiModelSelection(), { wrapper });
    act(() => {
      result.current.selectModel(MAX_ID);
    });

    // The write fails silently (same as its sibling setters); the catalog default
    // applies instead of a model that was never persisted.
    await waitFor(() => {
      expect(result.current.selectedModel?.id).toBe(DEFAULT_ID);
    });
  });
});
