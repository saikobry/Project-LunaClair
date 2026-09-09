import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollection } from '../useCollection';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Collection } from '../../../../../domain/collections/models/Collection';

describe('useCollection', () => {
  let queryClient: QueryClient;
  let mockGetById: ReturnType<typeof vi.fn>;

  const mockCollection: Collection = {
    id: 'c-1',
    title: 'Physics',
    description: 'Mechanics playlist',
    order: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetById = vi.fn().mockResolvedValue(mockCollection);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: { collection: { getById: mockGetById } },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('stays idle when collectionId is undefined', () => {
    const { result } = renderHook(() => useCollection(undefined), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.collection).toBeNull();
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('fetches the collection by id when provided', async () => {
    const { result } = renderHook(() => useCollection('c-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.collection).toEqual(mockCollection);
    expect(mockGetById).toHaveBeenCalledWith('c-1', expect.anything());
  });
});
