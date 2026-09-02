import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditMaterial } from '../useEditMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../../app/providers/ToastContext';
import { catalogQueryKeys } from '../../../../queries/catalogQueryKeys';
import type { StudyMaterial } from '../../../../../../domain/library/models/StudyMaterial';
import type { UpdateMaterialInput } from '../../../../../../domain/library/repositories/LibraryRepository';

describe('useEditMaterial', () => {
  let queryClient: QueryClient;
  let mockUpdateMaterialExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialMaterials: StudyMaterial[] = [
    { id: 'mat-1', documentId: 'doc-1', title: 'Original Title', description: 'Old desc', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
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

    mockUpdateMaterialExecute = vi.fn().mockResolvedValue({
      id: 'mat-1',
      title: 'Updated Title',
      description: 'New desc',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          updateMaterial: {
            execute: mockUpdateMaterialExecute,
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

  it('optimistically updates material in cache and invalidates on settle', async () => {
    const { result } = renderHook(() => useEditMaterial(), {
      wrapper: createWrapper(),
    });

    const input: UpdateMaterialInput = {
      title: 'Updated Title',
      description: 'New desc',
    };

    await act(async () => {
      await result.current.mutateAsync({ id: 'mat-1', input });
    });

    expect(mockUpdateMaterialExecute).toHaveBeenCalledWith('mat-1', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
  });

  it('rolls back optimistic cache update on error', async () => {
    mockUpdateMaterialExecute.mockRejectedValueOnce(new Error('Update failed'));

    const { result } = renderHook(() => useEditMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'mat-1', input: { title: 'Failed Title' } })
      ).rejects.toThrow('Update failed');
    });

    const cache = queryClient.getQueryData<StudyMaterial[]>(catalogQueryKeys.materials());
    expect(cache).toEqual(initialMaterials);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
  });
});
