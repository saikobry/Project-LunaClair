import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubject } from '../useSubject';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { Subject } from '../../../../../domain/library/models/Subject';

describe('useSubject', () => {
  let queryClient: QueryClient;
  let mockGetSubjectById: ReturnType<typeof vi.fn>;

  const mockSubject: Subject = {
    id: 'sub-bio',
    title: 'Biology',
    order: 0,
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

    mockGetSubjectById = vi.fn().mockResolvedValue(mockSubject);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        subject: {
          getSubjectById: mockGetSubjectById,
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

  it('stays idle when subjectId is undefined', () => {
    const { result } = renderHook(() => useSubject(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.subject).toBeNull();
    expect(mockGetSubjectById).not.toHaveBeenCalled();
  });

  it('fetches subject by id when subjectId is provided', async () => {
    const { result } = renderHook(() => useSubject('sub-bio'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subject).toEqual(mockSubject);
    expect(mockGetSubjectById).toHaveBeenCalledWith('sub-bio', expect.anything());
  });
});
