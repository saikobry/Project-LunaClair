import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubjects } from '../useSubjects';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Subject } from '../../../../../domain/library/models/Subject';

describe('useSubjects', () => {
  let queryClient: QueryClient;
  let mockGetSubjects: ReturnType<typeof vi.fn>;

  const mockSubjects: Subject[] = [
    { id: 'sub-2', title: 'Zoology', order: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'sub-1', title: 'Botany', order: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'sub-3', title: 'Anatomy', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetSubjects = vi.fn().mockResolvedValue(mockSubjects);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        subject: {
          getSubjects: mockGetSubjects,
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

  it('fetches and returns subjects sorted by order then title', async () => {
    const { result } = renderHook(() => useSubjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subjects).toHaveLength(3);
    // sub-1 (order: 1), sub-2 (order: 2), sub-3 (order: undefined -> 999)
    expect(result.current.subjects[0].id).toBe('sub-1');
    expect(result.current.subjects[1].id).toBe('sub-2');
    expect(result.current.subjects[2].id).toBe('sub-3');
  });

  it('handles error when getSubjects fails', async () => {
    mockGetSubjects.mockRejectedValueOnce(new Error('Failed to fetch subjects'));

    const { result } = renderHook(() => useSubjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.subjects).toEqual([]);
    expect(result.current.error?.message).toBe('Failed to fetch subjects');
  });
});
