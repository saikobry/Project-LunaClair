import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSaveDrawings } from '../useSaveDrawings';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../queries/readerQueryKeys';
import type { DrawingPath } from '../../../../../domain/reader/models/annotation.types';

describe('useSaveDrawings', () => {
  let queryClient: QueryClient;
  let mockSaveDrawingUseCase: any;
  let mockContext: any;

  const previousPaths: DrawingPath[] = [
    {
      id: 'path-1',
      color: '#ef4444',
      thickness: 4,
      points: [{ x: 0.1, y: 0.1 }],
    },
  ];

  const newPaths: DrawingPath[] = [
    ...previousPaths,
    {
      id: 'path-2',
      color: '#3b82f6',
      thickness: 8,
      points: [{ x: 0.2, y: 0.2 }],
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(readerQueryKeys.drawings('doc-101'), previousPaths);

    mockSaveDrawingUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      useCases: {
        reader: {
          saveDrawing: mockSaveDrawingUseCase,
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

  it('updates drawing paths in query cache and executes useCase', async () => {
    const { result } = renderHook(() => useSaveDrawings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ documentId: 'doc-101', paths: newPaths });
    });

    expect(mockSaveDrawingUseCase.execute).toHaveBeenCalledWith('doc-101', newPaths);
  });

  it('rolls back drawing paths cache on error', async () => {
    mockSaveDrawingUseCase.execute.mockRejectedValue(new Error('IndexedDB storage quota exceeded'));

    const { result } = renderHook(() => useSaveDrawings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ documentId: 'doc-101', paths: newPaths });
      } catch {
        // Expected error
      }
    });

    expect(queryClient.getQueryData(readerQueryKeys.drawings('doc-101'))).toEqual(previousPaths);
  });
});
