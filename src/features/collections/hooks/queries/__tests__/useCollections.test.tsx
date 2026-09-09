import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollections } from '../useCollections';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Collection } from '../../../../../domain/collections/models/Collection';

describe('useCollections', () => {
  let queryClient: QueryClient;
  let mockGetAll: ReturnType<typeof vi.fn>;

  const unordered: Collection[] = [
    { id: 'c-b', title: 'Beta', order: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c-a', title: 'Alpha', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetAll = vi.fn().mockResolvedValue(unordered);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: { collection: { getAll: mockGetAll } },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('returns collections sorted by order', async () => {
    const { result } = renderHook(() => useCollections(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.collections.map((c) => c.id)).toEqual(['c-a', 'c-b']);
    expect(mockGetAll).toHaveBeenCalledOnce();
  });

  it('returns an empty list when no collections exist', async () => {
    mockGetAll.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollections(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.collections).toEqual([]);
  });
});
