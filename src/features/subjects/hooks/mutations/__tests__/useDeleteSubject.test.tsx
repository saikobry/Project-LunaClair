import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteSubject } from '../useDeleteSubject';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { subjectQueryKeys } from '../../../queries/subjectQueryKeys';
import { materialQueryKeys } from '../../../../materials/queries/materialQueryKeys';

describe('useDeleteSubject', () => {
  let queryClient: QueryClient;
  let mockDeleteSubjectExecute: ReturnType<typeof vi.fn>;
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
    mockDeleteSubjectExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          deleteSubject: {
            execute: mockDeleteSubjectExecute,
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

  it('dispatches deleteSubject use case and invalidates subjects and materials queries on success', async () => {
    const { result } = renderHook(() => useDeleteSubject(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('sub-to-delete');
    });

    expect(mockDeleteSubjectExecute).toHaveBeenCalledWith('sub-to-delete');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subjectQueryKeys.subjects() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });

  it('handles error when deleteSubject fails', async () => {
    mockDeleteSubjectExecute.mockRejectedValueOnce(new Error('Delete error'));

    const { result } = renderHook(() => useDeleteSubject(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('sub-fail')).rejects.toThrow('Delete error');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
