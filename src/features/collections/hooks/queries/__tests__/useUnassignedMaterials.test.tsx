import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnassignedMaterials } from '../useUnassignedMaterials';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Collection } from '../../../../../domain/collections/models/Collection';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

describe('useUnassignedMaterials', () => {
  let queryClient: QueryClient;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;

  const now = '2026-08-01T00:00:00.000Z';
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'Assigned', documentId: 'doc-1', createdAt: now, updatedAt: now },
    { id: 'm-2', title: 'Free', documentId: 'doc-2', createdAt: now, updatedAt: now },
  ];
  const collections: Collection[] = [
    { id: 'c-1', title: 'Playlist', order: 0, createdAt: now, updatedAt: now },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
    mockGetAll = vi.fn().mockResolvedValue(collections);
    mockGetByCollectionId = vi.fn().mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now },
    ]);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        library: { getMaterials: mockGetMaterials },
        collection: { getAll: mockGetAll },
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
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

  it('returns only materials with zero junction rows', async () => {
    const { result } = renderHook(() => useUnassignedMaterials(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials.map((m) => m.id)).toEqual(['m-2']);
    expect(mockGetByCollectionId).toHaveBeenCalledWith('c-1', expect.anything());
  });
});
