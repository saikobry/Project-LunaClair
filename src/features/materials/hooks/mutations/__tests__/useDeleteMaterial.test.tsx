import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteMaterial } from '../useDeleteMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { materialQueryKeys } from '../../../queries/materialQueryKeys';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

describe('useDeleteMaterial', () => {
  let queryClient: QueryClient;
  let mockDeleteMaterialExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialMaterials: StudyMaterial[] = [
    { id: 'mat-keep', documentId: 'doc-keep', title: 'Keep Mat', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'mat-delete', documentId: 'doc-delete', title: 'Delete Mat', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
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

    mockDeleteMaterialExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          deleteMaterial: {
            execute: mockDeleteMaterialExecute,
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

  it('optimistically removes material from cache, calls use case, and invalidates on settle', async () => {
    const { result } = renderHook(() => useDeleteMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-delete');
    });

    expect(mockDeleteMaterialExecute).toHaveBeenCalledWith('mat-delete');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });

  it('rolls back optimistic deletion on error', async () => {
    mockDeleteMaterialExecute.mockRejectedValueOnce(new Error('Delete error'));

    const { result } = renderHook(() => useDeleteMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('mat-delete')).rejects.toThrow('Delete error');
    });

    const cache = queryClient.getQueryData<StudyMaterial[]>(materialQueryKeys.materials());
    expect(cache).toEqual(initialMaterials);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });
});
