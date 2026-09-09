import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollectionMaterials } from '../useCollectionMaterials';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { CollectionMaterial } from '../../../../../domain/collections/models/CollectionMaterial';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

describe('useCollectionMaterials', () => {
  let queryClient: QueryClient;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockGetMaterials: ReturnType<typeof vi.fn>;

  const links: CollectionMaterial[] = [
    { id: 2, collectionId: 'c-1', materialId: 'm-2', order: 1, addedAt: '2026-08-01T00:00:00.000Z' },
    { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: '2026-08-01T00:00:00.000Z' },
  ];
  const materials: StudyMaterial[] = [
    { id: 'm-2', title: 'Second', documentId: 'doc-2', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'm-1', title: 'First', documentId: 'doc-1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'm-3', title: 'Other', documentId: 'doc-3', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetByCollectionId = vi.fn().mockResolvedValue(links);
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
        library: { getMaterials: mockGetMaterials },
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

  it('stays idle when collectionId is undefined', () => {
    const { result } = renderHook(() => useCollectionMaterials(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.materials).toEqual([]);
    expect(mockGetByCollectionId).not.toHaveBeenCalled();
  });

  it('returns materials ordered by junction order', async () => {
    const { result } = renderHook(() => useCollectionMaterials('c-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials.map((m) => m.id)).toEqual(['m-1', 'm-2']);
  });

  it('returns an empty list when the collection has no links', async () => {
    mockGetByCollectionId.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollectionMaterials('c-empty'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials).toEqual([]);
    expect(mockGetMaterials).not.toHaveBeenCalled();
  });
});
