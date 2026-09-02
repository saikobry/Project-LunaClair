import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteHighlight } from '../useDeleteHighlight';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../queries/readerQueryKeys';
import type { HighlightItem } from '../../../../../domain/reader/models/annotation.types';

describe('useDeleteHighlight', () => {
  let queryClient: QueryClient;
  let mockSaveHighlightUseCase: any;
  let mockContext: any;

  const initialHighlights: HighlightItem[] = [
    {
      id: 'hl-1',
      start: 0,
      end: 10,
      color: 'yellow',
      text: 'First highlight',
    },
    {
      id: 'hl-2',
      start: 20,
      end: 30,
      color: 'green',
      text: 'Second highlight',
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

    mockSaveHighlightUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      useCases: {
        reader: {
          saveHighlight: mockSaveHighlightUseCase,
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

  it('optimistically filters out the highlight and calls saveHighlight with remainder', async () => {
    const { result } = renderHook(() => useDeleteHighlight(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ documentId: 'doc-101', highlightId: 'hl-1' });
    });

    expect(mockSaveHighlightUseCase.execute).toHaveBeenCalledWith('doc-101', [initialHighlights[1]]);
  });

  it('rolls back cache to previous state on error', async () => {
    mockSaveHighlightUseCase.execute.mockRejectedValue(new Error('Persistence failed'));

    const { result } = renderHook(() => useDeleteHighlight(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ documentId: 'doc-101', highlightId: 'hl-1' });
      } catch {
        // Expected error
      }
    });

    expect(queryClient.getQueryData(readerQueryKeys.highlights('doc-101'))).toEqual(initialHighlights);
  });
});
