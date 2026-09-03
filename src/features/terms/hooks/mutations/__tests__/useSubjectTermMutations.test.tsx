import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAddSubjectTerm,
  useRemoveSubjectTerm,
  useReorderSubjectTerms,
  useCreateAndAssignTerm,
} from '../useSubjectTermMutations';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { termQueryKeys } from '../../../queries/termQueryKeys';
import type { Term } from '../../../../../domain/library/models/Term';

describe('useSubjectTermMutations', () => {
  let queryClient: QueryClient;
  let mockAddTermExecute: ReturnType<typeof vi.fn>;
  let mockRemoveTermExecute: ReturnType<typeof vi.fn>;
  let mockReorderTermsExecute: ReturnType<typeof vi.fn>;
  let mockCreateAndAssignTermExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const initialTerms: Term[] = [
    { id: 'term-1', title: 'Prelim', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'term-2', title: 'Midterm', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'term-3', title: 'Finals', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
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

    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockAddTermExecute = vi.fn().mockResolvedValue(undefined);
    mockRemoveTermExecute = vi.fn().mockResolvedValue(undefined);
    mockReorderTermsExecute = vi.fn().mockResolvedValue(undefined);
    mockCreateAndAssignTermExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        subject: {
          addTerm: { execute: mockAddTermExecute },
          removeTerm: { execute: mockRemoveTermExecute },
          reorderTerms: { execute: mockReorderTermsExecute },
          createAndAssignTerm: { execute: mockCreateAndAssignTermExecute },
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

  describe('useAddSubjectTerm', () => {
    it('dispatches addTerm use case and invalidates subject terms cache', async () => {
      const { result } = renderHook(() => useAddSubjectTerm('sub-bio'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('term-1');
      });

      expect(mockAddTermExecute).toHaveBeenCalledWith('sub-bio', 'term-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.termsBySubject('sub-bio') });
    });
  });

  describe('useRemoveSubjectTerm', () => {
    it('dispatches removeTerm use case and invalidates subject terms cache', async () => {
      const { result } = renderHook(() => useRemoveSubjectTerm('sub-bio'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('term-1');
      });

      expect(mockRemoveTermExecute).toHaveBeenCalledWith('sub-bio', 'term-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.termsBySubject('sub-bio') });
    });
  });

  describe('useReorderSubjectTerms', () => {
    it('optimistically updates terms cache and calls reorder use case', async () => {
      queryClient.setQueryData(termQueryKeys.termsBySubject('sub-bio'), initialTerms);

      const { result } = renderHook(() => useReorderSubjectTerms('sub-bio'), {
        wrapper: createWrapper(),
      });

      const newOrder = ['term-3', 'term-1', 'term-2'];

      await act(async () => {
        await result.current.mutateAsync(newOrder);
      });

      expect(mockReorderTermsExecute).toHaveBeenCalledWith('sub-bio', newOrder);
    });

    it('rolls back optimistic cache update on reorder failure', async () => {
      queryClient.setQueryData(termQueryKeys.termsBySubject('sub-bio'), initialTerms);
      mockReorderTermsExecute.mockRejectedValueOnce(new Error('Reorder failed'));

      const { result } = renderHook(() => useReorderSubjectTerms('sub-bio'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync(['term-3', 'term-1', 'term-2'])).rejects.toThrow('Reorder failed');
      });

      const restored = queryClient.getQueryData<Term[]>(termQueryKeys.termsBySubject('sub-bio'));
      expect(restored).toEqual(initialTerms);
    });
  });

  describe('useCreateAndAssignTerm', () => {
    it('dispatches createAndAssignTerm use case and invalidates subject-terms and global terms caches', async () => {
      const { result } = renderHook(() => useCreateAndAssignTerm('sub-bio'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('Quarter 1');
      });

      expect(mockCreateAndAssignTermExecute).toHaveBeenCalledWith('sub-bio', 'Quarter 1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.termsBySubject('sub-bio') });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: termQueryKeys.terms() });
    });
  });
});
