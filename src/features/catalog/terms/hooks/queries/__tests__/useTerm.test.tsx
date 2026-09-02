import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTerm } from '../useTerm';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import type { Term } from '../../../../../../domain/library/models/Term';

describe('useTerm', () => {
  let queryClient: QueryClient;
  let mockGetTermById: ReturnType<typeof vi.fn>;

  const mockTerm: Term = {
    id: 'term-prelim',
    title: 'Prelim Term',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetTermById = vi.fn().mockResolvedValue(mockTerm);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        term: {
          getTermById: mockGetTermById,
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

  it('stays idle when termId is undefined', () => {
    const { result } = renderHook(() => useTerm(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.term).toBeNull();
    expect(mockGetTermById).not.toHaveBeenCalled();
  });

  it('fetches term by id when termId is provided', async () => {
    const { result } = renderHook(() => useTerm('term-prelim'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.term).toEqual(mockTerm);
    expect(mockGetTermById).toHaveBeenCalledWith('term-prelim', expect.anything());
  });
});
