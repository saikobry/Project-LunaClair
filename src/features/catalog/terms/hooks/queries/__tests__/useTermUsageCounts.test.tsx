import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTermUsageCounts } from '../useTermUsageCounts';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import type { Term } from '../../../../../../domain/library/models/Term';
import type { StudyMaterial } from '../../../../../../domain/library/models/StudyMaterial';

describe('useTermUsageCounts', () => {
  let queryClient: QueryClient;
  let mockGetTerms: ReturnType<typeof vi.fn>;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockGetSubjectIdsByTerm: ReturnType<typeof vi.fn>;

  const mockTerms: Term[] = [
    { id: 'term-1', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'term-2', title: 'Midterm', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  const mockMaterials: StudyMaterial[] = [
    { id: 'mat-1', documentId: 'doc-1', title: 'Mat 1', termId: 'term-1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'mat-2', documentId: 'doc-2', title: 'Mat 2', termId: 'term-1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'mat-3', documentId: 'doc-3', title: 'Mat 3', termId: 'term-2', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetTerms = vi.fn().mockResolvedValue(mockTerms);
    mockGetMaterials = vi.fn().mockResolvedValue(mockMaterials);
    mockGetSubjectIdsByTerm = vi.fn().mockImplementation((termId: string) => {
      if (termId === 'term-1') return Promise.resolve(['sub-bio', 'sub-chem']);
      return Promise.resolve(['sub-bio']);
    });
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        term: {
          getTerms: mockGetTerms,
        },
        library: {
          getMaterials: mockGetMaterials,
        },
        subjectTerm: {
          getSubjectIdsByTerm: mockGetSubjectIdsByTerm,
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

  it('computes subject count and material count for each term', async () => {
    const { result } = renderHook(() => useTermUsageCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.usageCounts.get('term-1')).toEqual({
        subjectCount: 2,
        materialCount: 2,
      });
    });

    const term2Counts = result.current.usageCounts.get('term-2');
    expect(term2Counts).toEqual({
      subjectCount: 1,
      materialCount: 1,
    });
  });
});
