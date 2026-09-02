import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSaveHighlights } from '../useSaveHighlights';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../queries/readerQueryKeys';
import type { HighlightItem } from '../../../../../domain/reader/models/annotation.types';

describe('useSaveHighlights', () => {
  let queryClient: QueryClient;
  let mockSaveHighlightUseCase: any;
  let mockContext: any;

  const previousHighlights: HighlightItem[] = [
    {
      id: 'hl-1',
      start: 0,
      end: 10,
      color: 'yellow',
      text: 'Existing highlight',
    },
  ];

  const newHighlights: HighlightItem[] = [
    ...previousHighlights,
    {
      id: 'hl-2',
      start: 20,
      end: 30,
      color: 'green',
      text: 'New highlight',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(readerQueryKeys.highlights('doc-101'), previousHighlights);

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

  it('optimistically updates highlights in query cache and executes useCase', async () => {
    const { result } = renderHook(() => useSaveHighlights(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ documentId: 'doc-101', highlights: newHighlights });
    });

    expect(mockSaveHighlightUseCase.execute).toHaveBeenCalledWith('doc-101', newHighlights);
  });

  it('rolls back cache on error', async () => {
    mockSaveHighlightUseCase.execute.mockRejectedValue(new Error('IndexedDB storage quota exceeded'));

    const { result } = renderHook(() => useSaveHighlights(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ documentId: 'doc-101', highlights: newHighlights });
      } catch {
        // Expected error
      }
    });

    expect(queryClient.getQueryData(readerQueryKeys.highlights('doc-101'))).toEqual(previousHighlights);
  });
});
