import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateTerm } from '../useCreateTerm';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { termQueryKeys } from '../../../queries/termQueryKeys';
import type { CreateTermInput } from '../../../../../domain/library/repositories/TermRepository';

describe('useCreateTerm', () => {
  let queryClient: QueryClient;
  let mockCreateTermExecute: ReturnType<typeof vi.fn>;
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
    mockCreateTermExecute = vi.fn().mockResolvedValue({
      id: 'term-new',
      title: 'Summer Session',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          createTerm: {
            execute: mockCreateTermExecute,
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

  it('dispatches createTerm use case and invalidates terms query on success', async () => {
    const { result } = renderHook(() => useCreateTerm(), {
      wrapper: createWrapper(),
    });

    const input: CreateTermInput = {
      title: 'Summer Session',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockCreateTermExecute).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.terms() });
  });

  it('handles error when createTerm fails', async () => {
    mockCreateTermExecute.mockRejectedValueOnce(new Error('Duplicate term title'));

    const { result } = renderHook(() => useCreateTerm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ title: 'Duplicate' })).rejects.toThrow('Duplicate term title');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
