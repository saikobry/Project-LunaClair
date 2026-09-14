import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLibrary } from '../useLibrary';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

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

  it('returns materials in authored order, not repository id order', async () => {
    // `seed-m-10` sorts before `seed-m-2` by primary key — the hook must
    // still expose 1, 2, 10.
    mockGetMaterials.mockResolvedValueOnce([
      { id: 'seed-m-1', documentId: 'doc-1', title: 'M 1', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'seed-m-10', documentId: 'doc-10', title: 'M 10', order: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'seed-m-2', documentId: 'doc-2', title: 'M 2', order: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    ]);
    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials.map((m) => m.id)).toEqual(['seed-m-1', 'seed-m-2', 'seed-m-10']);
  });

  it('sorts materials without order last, stably', async () => {
    mockGetMaterials.mockResolvedValueOnce([
      { id: 'b', documentId: 'doc-b', title: 'B', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'a', documentId: 'doc-a', title: 'A', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    ]);
    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials.map((m) => m.id)).toEqual(['a', 'b']);
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
