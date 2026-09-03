import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTouchMaterial } from '../useTouchMaterial';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { materialQueryKeys } from '../../../queries/materialQueryKeys';

describe('useTouchMaterial', () => {
  let queryClient: QueryClient;
  let mockTouchMaterialExecute: ReturnType<typeof vi.fn>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockTouchMaterialExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        library: {
          touchMaterial: {
            execute: mockTouchMaterialExecute,
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

  it('dispatches touchMaterial use case and invalidates materials cache on settle', async () => {
    const { result } = renderHook(() => useTouchMaterial(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('mat-touch-1');
    });

    expect(mockTouchMaterialExecute).toHaveBeenCalledWith('mat-touch-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.materials() });
  });
});
