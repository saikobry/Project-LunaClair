import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubjectTermUsage } from '../useSubjectTermUsage';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Term } from '../../../../../domain/library/models/Term';

describe('useSubjectTermUsage', () => {
  let queryClient: QueryClient;
  let mockGetSubjectIdsByTerm: ReturnType<typeof vi.fn>;

  const mockTerms: Term[] = [
    { id: 'term-1', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'term-2', title: 'Midterm', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetSubjectIdsByTerm = vi.fn().mockImplementation((termId: string) => {
      if (termId === 'term-1') return Promise.resolve(['sub-bio', 'sub-chem', 'sub-phys']);
      return Promise.resolve(['sub-bio']);
    });
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
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

  it('computes subject count map for provided terms', async () => {
    const { result } = renderHook(() => useSubjectTermUsage('sub-bio', mockTerms), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subjectCounts.get('term-1')).toBe(3);
    expect(result.current.subjectCounts.get('term-2')).toBe(1);
  });
});
