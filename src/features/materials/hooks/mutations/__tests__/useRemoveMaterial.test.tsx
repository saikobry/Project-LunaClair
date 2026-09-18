import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemoveMaterial } from '../useRemoveMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { materialQueryKeys } from '../../../queries/materialQueryKeys';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

describe('useRemoveMaterial', () => {
  let queryClient: QueryClient;
  let mockRemoveMaterialExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialMaterials: StudyMaterial[] = [
    { id: 'mat-keep', documentId: 'doc-keep', title: 'Keep Mat', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'mat-remove', documentId: 'doc-remove', title: 'Remove Mat', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    queryClient.setQueryData(materialQueryKeys.materials(), initialMaterials);
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mockRemoveMaterialExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    /*
     * The removal path delegates to the atomic cascade — this is the only removal use case
     * exposed by the application graph (a row-only delete no longer exists to mock).
     */
    const mockContextValue = {
      useCases: {
        library: {
          removeMaterial: {
            execute: mockRemoveMaterialExecute,
          },
        },
      },
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

  it('optimistically removes material from cache, calls the cascade use case, and invalidates on settle', async () => {
    const { result } = renderHook(() => useRemoveMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-remove');
    });

    expect(mockRemoveMaterialExecute).toHaveBeenCalledWith('mat-remove');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.all });
  });

  it('reconciles every cache the cascade can have emptied', async () => {
    const { result } = renderHook(() => useRemoveMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-remove');
    });

    // The cascade also clears questions, quizzes, document content, collection membership, and the
    // analytics derived from the material — a materials-only invalidation would leave those stale.
    for (const prefix of ['questions', 'quizzes', 'assessment', 'collections', 'analytics']) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [prefix] });
    }

    // The detail key is a sibling namespace (`['library','material',id]`), NOT a child of
    // `materialQueryKeys.all` (`['library','materials']`) — prefix matching is segment-wise, so
    // without an explicit invalidation a removed material stays warm in the detail cache.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.material('mat-remove') });
  });

  it('rolls back the optimistic removal on error', async () => {
    mockRemoveMaterialExecute.mockRejectedValueOnce(new Error('Removal error'));

    const { result } = renderHook(() => useRemoveMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('mat-remove')).rejects.toThrow('Removal error');
    });

    const cache = queryClient.getQueryData<StudyMaterial[]>(materialQueryKeys.materials());
    expect(cache).toEqual(initialMaterials);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.all });
  });
});
