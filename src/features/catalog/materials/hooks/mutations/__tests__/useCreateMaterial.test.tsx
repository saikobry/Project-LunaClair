import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateMaterial } from '../useCreateMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../../app/providers/ToastContext';
import { catalogQueryKeys } from '../../../../queries/catalogQueryKeys';
import type { StudyMaterial } from '../../../../../../domain/library/models/StudyMaterial';
import type { CreateMaterialInput } from '../../../../../../domain/library/repositories/LibraryRepository';

describe('useCreateMaterial', () => {
  let queryClient: QueryClient;
  let mockCreateMaterialExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialMaterials: StudyMaterial[] = [
    { id: 'mat-1', documentId: 'doc-1', title: 'Existing Mat', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
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

    queryClient.setQueryData(catalogQueryKeys.materials(), initialMaterials);
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mockCreateMaterialExecute = vi.fn().mockResolvedValue({
      id: 'mat-created',
      title: 'New Material',
      documentId: 'doc-created',
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          createMaterial: {
            execute: mockCreateMaterialExecute,
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

  it('optimistically appends material to cache, executes use case, and invalidates on settle', async () => {
    const { result } = renderHook(() => useCreateMaterial(), {
      wrapper: createWrapper(),
    });

    const input: CreateMaterialInput = {
      title: 'New Material',
      description: 'Material description',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockCreateMaterialExecute).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
  });

  it('rolls back optimistic cache addition on mutation failure', async () => {
    mockCreateMaterialExecute.mockRejectedValueOnce(new Error('Creation failed'));

    const { result } = renderHook(() => useCreateMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ title: 'Failed Mat' })).rejects.toThrow('Creation failed');
    });

    const cache = queryClient.getQueryData<StudyMaterial[]>(catalogQueryKeys.materials());
    expect(cache).toEqual(initialMaterials);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
  });
});
