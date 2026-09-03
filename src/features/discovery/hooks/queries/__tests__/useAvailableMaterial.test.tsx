import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailableMaterial } from '../useAvailableMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { MaterialResolution } from '../../../../../domain/library/repositories/CatalogRepository';

describe('useAvailableMaterial', () => {
  let queryClient: QueryClient;
  let mockGetMaterial: ReturnType<typeof vi.fn>;

  const mockResolution: MaterialResolution = {
    material: {
      id: 'mat-remote-1',
      title: 'Neuroanatomy Overview',
      documentId: 'doc-neuro',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    subject: {
      id: 'sub-neuro',
      title: 'Neuroscience',
      order: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    term: {
      id: 'term-midterm',
      title: 'Midterm',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetMaterial = vi.fn().mockResolvedValue(mockResolution);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        catalog: {
          getMaterial: mockGetMaterial,
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('is disabled when materialId is undefined or empty', () => {
    const { result: r1 } = renderHook(() => useAvailableMaterial(undefined), {
      wrapper: createWrapper(),
    });
    expect(r1.current.isLoading).toBe(false);
    expect(mockGetMaterial).not.toHaveBeenCalled();

    const { result: r2 } = renderHook(() => useAvailableMaterial(''), {
      wrapper: createWrapper(),
    });
    expect(r2.current.isLoading).toBe(false);
    expect(mockGetMaterial).not.toHaveBeenCalled();
  });

  it('fetches material resolution authoritatively by id', async () => {
    const { result } = renderHook(() => useAvailableMaterial('mat-remote-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResolution);
    expect(mockGetMaterial).toHaveBeenCalledWith('mat-remote-1', expect.anything());
  });

  it('handles remote material resolution failures', async () => {
    mockGetMaterial.mockRejectedValueOnce(new Error('Material not found on server'));

    const { result } = renderHook(() => useAvailableMaterial('mat-remote-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Material not found on server');
  });
});
