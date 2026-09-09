import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateCollection } from '../useCreateCollection';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { collectionQueryKeys } from '../../../queries/collectionQueryKeys';

describe('useCreateCollection', () => {
  let queryClient: QueryClient;
  let mockExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockExecute = vi.fn().mockResolvedValue({
      id: 'c-new',
      title: 'New Playlist',
      order: 0,
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: { collections: { createCollection: { execute: mockExecute } } },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('executes the use case and invalidates the collections cache', async () => {
    const { result } = renderHook(() => useCreateCollection(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ title: 'New Playlist' });
    });

    expect(mockExecute).toHaveBeenCalledWith({ title: 'New Playlist' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: collectionQueryKeys.all });
  });
});
