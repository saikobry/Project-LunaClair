import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReorderSubjects } from '../useReorderSubjects';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { subjectQueryKeys } from '../../../queries/subjectQueryKeys';
import type { Subject } from '../../../../../domain/library/models/Subject';

describe('useReorderSubjects', () => {
  let queryClient: QueryClient;
  let mockReorderSubjectsExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialSubjects: Subject[] = [
    { id: 'sub-a', title: 'Subject A', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'sub-b', title: 'Subject B', order: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'sub-c', title: 'Subject C', order: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    queryClient.setQueryData(subjectQueryKeys.subjects(), initialSubjects);

    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockReorderSubjectsExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          reorderSubjects: {
            execute: mockReorderSubjectsExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('optimistically updates cache, executes reorder use case, and reconciles on settle', async () => {
    const { result } = renderHook(() => useReorderSubjects(), {
      wrapper: createWrapper(),
    });

    const desiredOrder = ['sub-c', 'sub-a', 'sub-b'];

    await act(async () => {
      await result.current.mutateAsync({ orderedIds: desiredOrder });
    });

    expect(mockReorderSubjectsExecute).toHaveBeenCalledWith(desiredOrder);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subjectQueryKeys.subjects() });
  });

  it('rolls back optimistic cache update on mutation failure', async () => {
    mockReorderSubjectsExecute.mockRejectedValueOnce(new Error('Reorder failed'));

    const { result } = renderHook(() => useReorderSubjects(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ orderedIds: ['sub-c', 'sub-a', 'sub-b'] })
      ).rejects.toThrow('Reorder failed');
    });

    const rolledBackCache = queryClient.getQueryData<Subject[]>(subjectQueryKeys.subjects());
    expect(rolledBackCache).toEqual(initialSubjects);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subjectQueryKeys.subjects() });
  });
});
