import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateSubject } from '../useCreateSubject';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../../app/providers/ToastContext';
import { catalogQueryKeys } from '../../../../queries/catalogQueryKeys';
import type { CreateSubjectInput } from '../../../../../../domain/library/repositories/SubjectRepository';

describe('useCreateSubject', () => {
  let queryClient: QueryClient;
  let mockCreateSubjectExecute: ReturnType<typeof vi.fn>;
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
    mockCreateSubjectExecute = vi.fn().mockResolvedValue({
      id: 'sub-new',
      title: 'Biochemistry',
      order: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          createSubject: {
            execute: mockCreateSubjectExecute,
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

  it('dispatches createSubject use case and invalidates subjects query on success', async () => {
    const { result } = renderHook(() => useCreateSubject(), {
      wrapper: createWrapper(),
    });

    const input: CreateSubjectInput = {
      title: 'Biochemistry',
      description: 'Metabolic pathways',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockCreateSubjectExecute).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.subjects() });
  });

  it('handles error when createSubject fails', async () => {
    mockCreateSubjectExecute.mockRejectedValueOnce(new Error('Duplicate subject title'));

    const { result } = renderHook(() => useCreateSubject(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ title: 'Biochemistry' })
      ).rejects.toThrow('Duplicate subject title');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
