import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailableCatalog } from '../useAvailableCatalog';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { CatalogSnapshot } from '../../../../../domain/library/repositories/CatalogRepository';

describe('useAvailableCatalog', () => {
  let queryClient: QueryClient;
  let mockGetCatalog: ReturnType<typeof vi.fn>;

  const mockCatalog: CatalogSnapshot = {
    subjects: [{ id: 'sub-bio', title: 'Biology', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
    terms: [{ id: 'term-prelim', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
    subjectTerms: [{ subjectId: 'sub-bio', termId: 'term-prelim', order: 0 }],
    materials: [
      {
        id: 'mat-1',
        documentId: 'doc-1',
        title: 'Cell Biology',
        description: 'Organelle structure and function',
        subjectId: 'sub-bio',
        termId: 'term-prelim',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetCatalog = vi.fn().mockResolvedValue(mockCatalog);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        catalog: {
          getCatalog: mockGetCatalog,
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

  it('fetches remote catalog snapshot on mount', async () => {
    const { result } = renderHook(() => useAvailableCatalog(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.catalog).toEqual(mockCatalog);
    expect(result.current.isError).toBe(false);
    expect(mockGetCatalog).toHaveBeenCalledTimes(1);
  });

  it('handles remote catalog fetch errors', async () => {
    mockGetCatalog.mockRejectedValueOnce(new Error('Failed to fetch catalog'));

    const { result } = renderHook(() => useAvailableCatalog(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Failed to fetch catalog');
  });
});
