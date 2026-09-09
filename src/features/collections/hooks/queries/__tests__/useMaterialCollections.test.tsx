import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaterialCollections } from '../useMaterialCollections';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Collection } from '../../../../../domain/collections/models/Collection';
import type { CollectionMaterial } from '../../../../../domain/collections/models/CollectionMaterial';

describe('useMaterialCollections', () => {
  let queryClient: QueryClient;
  let mockGetByMaterialId: ReturnType<typeof vi.fn>;
  let mockGetAll: ReturnType<typeof vi.fn>;

  const links: CollectionMaterial[] = [
    { id: 1, collectionId: 'c-2', materialId: 'm-1', order: 0, addedAt: '2026-08-01T00:00:00.000Z' },
    { id: 2, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: '2026-08-01T00:00:00.000Z' },
  ];
  const all: Collection[] = [
    { id: 'c-1', title: 'Alpha', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c-2', title: 'Beta', order: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c-3', title: 'Gamma', order: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetByMaterialId = vi.fn().mockResolvedValue(links);
    mockGetAll = vi.fn().mockResolvedValue(all);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        collectionMaterial: { getByMaterialId: mockGetByMaterialId },
        collection: { getAll: mockGetAll },
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
    const { result } = renderHook(() => useMaterialCollections(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.collections).toEqual([]);
    expect(result.current.collectionIds).toEqual([]);
    expect(mockGetByMaterialId).not.toHaveBeenCalled();
  });

  it('returns only the collections containing the material', async () => {
    const { result } = renderHook(() => useMaterialCollections('m-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.collections.map((c) => c.id)).toEqual(['c-1', 'c-2']);
    expect(result.current.collectionIds).toEqual(['c-1', 'c-2']);
  });
});
