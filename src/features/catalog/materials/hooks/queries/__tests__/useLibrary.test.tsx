import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLibrary } from '../useLibrary';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../../../domain/library/models/StudyMaterial';

describe('useLibrary', () => {
  let queryClient: QueryClient;
  let mockGetMaterials: ReturnType<typeof vi.fn>;

  const mockMaterials: StudyMaterial[] = [
    { id: 'mat-1', documentId: 'doc-1', title: 'Cell Biology', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'mat-2', documentId: 'doc-2', title: 'Genetics', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetMaterials = vi.fn().mockResolvedValue(mockMaterials);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        library: {
          getMaterials: mockGetMaterials,
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

  it('fetches library materials on mount', async () => {
    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials).toEqual(mockMaterials);
    expect(result.current.isError).toBe(false);
  });

  it('handles errors when getMaterials fails', async () => {
    mockGetMaterials.mockRejectedValueOnce(new Error('IndexedDB failure'));

    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.materials).toEqual([]);
    expect(result.current.error?.message).toBe('IndexedDB failure');
  });
});
