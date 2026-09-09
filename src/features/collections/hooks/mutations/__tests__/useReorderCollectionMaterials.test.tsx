import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReorderCollectionMaterials } from '../useReorderCollectionMaterials';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { collectionQueryKeys } from '../../../queries/collectionQueryKeys';

describe('useReorderCollectionMaterials', () => {
  let queryClient: QueryClient;
  let mockExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: { collections: { reorderCollectionMaterials: { execute: mockExecute } } },
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

  it('executes the use case and invalidates the collection materials cache', async () => {
    const { result } = renderHook(() => useReorderCollectionMaterials(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ collectionId: 'c-1', orderedMaterialIds: ['m-2', 'm-1'] });
    });

    expect(mockExecute).toHaveBeenCalledWith('c-1', ['m-2', 'm-1']);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: collectionQueryKeys.materials('c-1'),
    });
  });
});
