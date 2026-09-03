import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTerms } from '../useTerms';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Term } from '../../../../../domain/library/models/Term';

describe('useTerms', () => {
  let queryClient: QueryClient;
  let mockGetTerms: ReturnType<typeof vi.fn>;
  let mockGetTermsBySubject: ReturnType<typeof vi.fn>;

  const mockGlobalTerms: Term[] = [
    { id: 'term-1', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'term-2', title: 'Midterm', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  const mockSubjectTerms: Term[] = [
    { id: 'term-1', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetTerms = vi.fn().mockResolvedValue(mockGlobalTerms);
    mockGetTermsBySubject = vi.fn().mockResolvedValue(mockSubjectTerms);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        term: {
          getTerms: mockGetTerms,
        },
        subjectTerm: {
          getTermsBySubject: mockGetTermsBySubject,
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

  it('fetches global terms when subjectId is omitted', async () => {
    const { result } = renderHook(() => useTerms(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.terms).toEqual(mockGlobalTerms);
    expect(mockGetTerms).toHaveBeenCalledTimes(1);
    expect(mockGetTermsBySubject).not.toHaveBeenCalled();
  });

  it('fetches subject-scoped terms when subjectId is provided', async () => {
    const { result } = renderHook(() => useTerms('sub-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.terms).toEqual(mockSubjectTerms);
    expect(mockGetTermsBySubject).toHaveBeenCalledWith('sub-123', expect.anything());
    expect(mockGetTerms).not.toHaveBeenCalled();
  });
});
