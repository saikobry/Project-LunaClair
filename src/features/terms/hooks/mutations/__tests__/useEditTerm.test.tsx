import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditTerm } from '../useEditTerm';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { termQueryKeys } from '../../../queries/termQueryKeys';
import type { UpdateTermInput } from '../../../../../domain/library/repositories/TermRepository';

describe('useEditTerm', () => {
  let queryClient: QueryClient;
  let mockUpdateTermExecute: ReturnType<typeof vi.fn>;
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
    mockUpdateTermExecute = vi.fn().mockResolvedValue({
      id: 'term-1',
      title: 'Final Term',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          updateTerm: {
            execute: mockUpdateTermExecute,
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

  it('dispatches updateTerm use case and invalidates terms cache on success', async () => {
    const { result } = renderHook(() => useEditTerm(), {
      wrapper: createWrapper(),
    });

    const input: UpdateTermInput = {
      title: 'Final Term',
    };

    await act(async () => {
      await result.current.mutateAsync({ id: 'term-1', input });
    });

    expect(mockUpdateTermExecute).toHaveBeenCalledWith('term-1', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.terms() });
  });

  it('handles error when updateTerm fails', async () => {
    mockUpdateTermExecute.mockRejectedValueOnce(new Error('Update failed'));

    const { result } = renderHook(() => useEditTerm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'term-1', input: { title: 'Fail' } })
      ).rejects.toThrow('Update failed');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
