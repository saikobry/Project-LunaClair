import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteTerm } from '../useDeleteTerm';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { termQueryKeys } from '../../../queries/termQueryKeys';
import { materialQueryKeys } from '../../../../materials/queries/materialQueryKeys';

describe('useDeleteTerm', () => {
  let queryClient: QueryClient;
  let mockDeleteTermExecute: ReturnType<typeof vi.fn>;
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
    mockDeleteTermExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          deleteTerm: {
            execute: mockDeleteTermExecute,
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

  it('dispatches deleteTerm use case and invalidates terms and materials queries on success', async () => {
    const { result } = renderHook(() => useDeleteTerm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('term-delete-123');
    });

    expect(mockDeleteTermExecute).toHaveBeenCalledWith('term-delete-123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.terms() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });

  it('handles error when deleteTerm fails', async () => {
    mockDeleteTermExecute.mockRejectedValueOnce(new Error('Delete term failed'));

    const { result } = renderHook(() => useDeleteTerm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('term-fail')).rejects.toThrow('Delete term failed');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
