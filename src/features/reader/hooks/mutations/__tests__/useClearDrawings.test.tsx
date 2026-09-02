import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClearDrawings } from '../useClearDrawings';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../queries/readerQueryKeys';
import type { DrawingPath } from '../../../../../domain/reader/models/annotation.types';

describe('useClearDrawings', () => {
  let queryClient: QueryClient;
  let mockClearAnnotationsUseCase: any;
  let mockContext: any;

  const initialPaths: DrawingPath[] = [
    {
      id: 'path-1',
      color: '#ef4444',
      thickness: 4,
      points: [{ x: 0.1, y: 0.1 }],
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(readerQueryKeys.drawings('doc-101'), initialPaths);

    mockClearAnnotationsUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      useCases: {
        reader: {
          clearAnnotations: mockClearAnnotationsUseCase,
        },
      },
    };
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    </QueryClientProvider>
  );

  it('clears all drawings in cache and calls clearAnnotations useCase with drawings', async () => {
    const { result } = renderHook(() => useClearDrawings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('doc-101');
    });

    expect(mockClearAnnotationsUseCase.execute).toHaveBeenCalledWith('doc-101', 'drawings');
  });

  it('rolls back cache to previous drawings on error', async () => {
    mockClearAnnotationsUseCase.execute.mockRejectedValue(new Error('Clear drawings failed'));

    const { result } = renderHook(() => useClearDrawings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync('doc-101');
      } catch {
        // Expected error
      }
    });

    expect(queryClient.getQueryData(readerQueryKeys.drawings('doc-101'))).toEqual(initialPaths);
  });
});
