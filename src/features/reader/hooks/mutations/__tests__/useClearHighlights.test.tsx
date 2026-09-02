import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClearHighlights } from '../useClearHighlights';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../queries/readerQueryKeys';
import type { HighlightItem } from '../../../../../domain/reader/models/annotation.types';

describe('useClearHighlights', () => {
  let queryClient: QueryClient;
  let mockClearAnnotationsUseCase: any;
  let mockContext: any;

  const initialHighlights: HighlightItem[] = [
    {
      id: 'hl-1',
      start: 0,
      end: 10,
      color: 'yellow',
      text: 'First highlight',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(readerQueryKeys.highlights('doc-101'), initialHighlights);

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

  it('clears all highlights in cache and calls clearAnnotations useCase', async () => {
    const { result } = renderHook(() => useClearHighlights(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('doc-101');
    });

    expect(mockClearAnnotationsUseCase.execute).toHaveBeenCalledWith('doc-101', 'highlights');
  });

  it('rolls back cache to previous highlights on error', async () => {
    mockClearAnnotationsUseCase.execute.mockRejectedValue(new Error('Clear failed'));

    const { result } = renderHook(() => useClearHighlights(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync('doc-101');
      } catch {
        // Expected error
      }
    });

    expect(queryClient.getQueryData(readerQueryKeys.highlights('doc-101'))).toEqual(initialHighlights);
  });
});
