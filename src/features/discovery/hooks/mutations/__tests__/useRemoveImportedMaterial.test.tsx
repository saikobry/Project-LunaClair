import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemoveImportedMaterial } from '../useRemoveImportedMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { discoveryQueryKeys } from '../../../queries/discoveryQueryKeys';
import { materialQueryKeys } from '../../../../materials/queries/materialQueryKeys';
import { subjectQueryKeys } from '../../../../subjects/queries/subjectQueryKeys';

describe('useRemoveImportedMaterial', () => {
  let queryClient: QueryClient;
  let mockRemoveExecute: ReturnType<typeof vi.fn>;
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
    mockRemoveExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          removeImportedMaterial: {
            execute: mockRemoveExecute,
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

  it('dispatches remove use case and invalidates materials, subjects, and catalog queries on success', async () => {
    const { result } = renderHook(() => useRemoveImportedMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-remove-123');
    });

    expect(mockRemoveExecute).toHaveBeenCalledWith('mat-remove-123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subjectQueryKeys.subjects() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: discoveryQueryKeys.catalog() });
  });

  it('propagates error when remove use case fails', async () => {
    mockRemoveExecute.mockRejectedValueOnce(new Error('Deletion failed'));

    const { result } = renderHook(() => useRemoveImportedMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('mat-fail')).rejects.toThrow('Deletion failed');
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });
});
