import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaterial } from '../useMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

describe('useMaterial', () => {
  let queryClient: QueryClient;
  let mockGetMaterialById: ReturnType<typeof vi.fn>;

  const mockMaterial: StudyMaterial = {
    id: 'mat-1',
    documentId: 'doc-1',
    title: 'Cell Biology',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetMaterialById = vi.fn().mockResolvedValue(mockMaterial);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        library: {
          getMaterialById: mockGetMaterialById,
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

  it('stays idle when materialId is undefined', () => {
    const { result } = renderHook(() => useMaterial(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.material).toBeNull();
    expect(mockGetMaterialById).not.toHaveBeenCalled();
  });

  it('fetches material by id when materialId is provided', async () => {
    const { result } = renderHook(() => useMaterial('mat-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.material).toEqual(mockMaterial);
    expect(mockGetMaterialById).toHaveBeenCalledWith('mat-1', expect.anything());
  });
});
