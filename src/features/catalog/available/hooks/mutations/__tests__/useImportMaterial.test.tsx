import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImportMaterial } from '../useImportMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../../app/providers/ToastContext';
import { catalogQueryKeys } from '../../../../queries/catalogQueryKeys';

describe('useImportMaterial', () => {
  let queryClient: QueryClient;
  let mockImportExecute: ReturnType<typeof vi.fn>;
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
    mockImportExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          importMaterial: {
            execute: mockImportExecute,
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

  it('dispatches import use case and invalidates materials, subjects, and catalog queries on success', async () => {
    const { result } = renderHook(() => useImportMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-import-123');
    });

    expect(mockImportExecute).toHaveBeenCalledWith('mat-import-123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.subjects() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: catalogQueryKeys.catalog() });
  });

  it('propagates error when import use case fails', async () => {
    mockImportExecute.mockRejectedValueOnce(new Error('Network import failure'));

    const { result } = renderHook(() => useImportMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('mat-fail')).rejects.toThrow('Network import failure');
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: catalogQueryKeys.materials() });
  });
});
