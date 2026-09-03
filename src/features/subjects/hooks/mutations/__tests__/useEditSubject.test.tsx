import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditSubject } from '../useEditSubject';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { subjectQueryKeys } from '../../../queries/subjectQueryKeys';
import type { UpdateSubjectInput } from '../../../../../domain/library/repositories/SubjectRepository';

describe('useEditSubject', () => {
  let queryClient: QueryClient;
  let mockUpdateSubjectExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

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

    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockUpdateSubjectExecute = vi.fn().mockResolvedValue({
      id: 'sub-1',
      title: 'Advanced Biochemistry',
      order: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          updateSubject: {
            execute: mockUpdateSubjectExecute,
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

  it('dispatches updateSubject use case with id and input, and invalidates subjects cache', async () => {
    const { result } = renderHook(() => useEditSubject(), {
      wrapper: createWrapper(),
    });

    const input: UpdateSubjectInput = {
      title: 'Advanced Biochemistry',
      description: 'Enzyme kinetics and regulation',
    };

    await act(async () => {
      await result.current.mutateAsync({ id: 'sub-1', input });
    });

    expect(mockUpdateSubjectExecute).toHaveBeenCalledWith('sub-1', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subjectQueryKeys.subjects() });
  });

  it('handles error when updateSubject fails', async () => {
    mockUpdateSubjectExecute.mockRejectedValueOnce(new Error('Update failed'));

    const { result } = renderHook(() => useEditSubject(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'sub-1', input: { title: 'Fail' } })
      ).rejects.toThrow('Update failed');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
