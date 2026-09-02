import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHighlights } from '../useHighlights';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { HighlightItem } from '../../../../domain/reader/models/annotation.types';

describe('useHighlights', () => {
  let queryClient: QueryClient;
  let mockAnnotationRepo: any;
  let mockSaveHighlightUseCase: any;
  let mockClearAnnotationsUseCase: any;
  let mockContext: any;

  const initialHighlights: HighlightItem[] = [
    {
      id: 'hl-1',
      start: 0,
      end: 11,
      color: 'yellow',
      text: 'Hello World',
    },
    {
      id: 'hl-2',
      start: 16,
      end: 28,
      color: 'green',
      text: 'Mitochondria',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockAnnotationRepo = {
      getHighlights: vi.fn().mockResolvedValue(initialHighlights),
      saveHighlights: vi.fn().mockResolvedValue(undefined),
      clearHighlights: vi.fn().mockResolvedValue(undefined),
      getDrawings: vi.fn().mockResolvedValue([]),
      saveDrawings: vi.fn().mockResolvedValue(undefined),
      clearDrawings: vi.fn().mockResolvedValue(undefined),
    };

    mockSaveHighlightUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockClearAnnotationsUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      repositories: {
        annotation: mockAnnotationRepo,
      },
      useCases: {
        reader: {
          saveHighlight: mockSaveHighlightUseCase,
          clearAnnotations: mockClearAnnotationsUseCase,
        },
      },
    };
  });

  afterEach(() => {
    delete (window as any).CSS;
    delete (window as any).Highlight;
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    </QueryClientProvider>
  );

  it('fetches initial highlights for documentId from annotation repository', async () => {
    const { result } = renderHook(() => useHighlights('doc-101', 'Sample document content'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toEqual(initialHighlights);
    });

    expect(mockAnnotationRepo.getHighlights).toHaveBeenCalledWith('doc-101', expect.anything());
    expect(result.current.containerRef).toBeDefined();
  });

  it('returns empty array when repository resolves no highlights', async () => {
    mockAnnotationRepo.getHighlights.mockResolvedValue([]);

    const { result } = renderHook(() => useHighlights('doc-empty', 'Empty doc'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toEqual([]);
    });
  });

  it('adds a new highlight and triggers save mutation with new item appended', async () => {
    const { result } = renderHook(() => useHighlights('doc-101', 'Sample document content'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toHaveLength(2);
    });

    act(() => {
      result.current.addHighlight(40, 55, 'pink', 'Added highlight');
    });

    await waitFor(() => {
      expect(mockSaveHighlightUseCase.execute).toHaveBeenCalledWith(
        'doc-101',
        expect.arrayContaining([
          initialHighlights[0],
          initialHighlights[1],
          expect.objectContaining({
            start: 40,
            end: 55,
            color: 'pink',
            text: 'Added highlight',
          }),
        ]),
      );
    });
  });

  it('deletes a highlight by ID and triggers save mutation with filtered array', async () => {
    const { result } = renderHook(() => useHighlights('doc-101', 'Sample document content'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toHaveLength(2);
    });

    act(() => {
      result.current.deleteHighlight('hl-1');
    });

    await waitFor(() => {
      expect(mockSaveHighlightUseCase.execute).toHaveBeenCalledWith(
        'doc-101',
        [initialHighlights[1]],
      );
    });
  });

  it('clears all highlights and triggers clearAnnotations use case', async () => {
    const { result } = renderHook(() => useHighlights('doc-101', 'Sample document content'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toHaveLength(2);
    });

    act(() => {
      result.current.clearHighlights();
    });

    await waitFor(() => {
      expect(mockClearAnnotationsUseCase.execute).toHaveBeenCalledWith('doc-101', 'highlights');
    });
  });

  it('registers CSS Custom Highlight API when available', async () => {
    const mockHighlightMap = {
      set: vi.fn(),
      delete: vi.fn(),
    };

    class MockHighlight {
      ranges: Range[];
      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }

    (window as any).CSS = {
      highlights: mockHighlightMap,
    };
    (window as any).Highlight = MockHighlight;

    const containerDiv = document.createElement('div');
    const textNode = document.createTextNode('Hello World and Mitochondria is important.');
    containerDiv.appendChild(textNode);
    document.body.appendChild(containerDiv);

    const { result, rerender } = renderHook(
      ({ content }) => useHighlights('doc-101', content),
      {
        wrapper: createWrapper(),
        initialProps: { content: 'Hello World and Mitochondria is important.' },
      },
    );

    result.current.containerRef.current = containerDiv;

    await waitFor(() => {
      expect(result.current.highlights).toHaveLength(2);
    });

    // Trigger effect rerun with containerRef attached
    rerender({ content: 'Hello World and Mitochondria is important. Updated.' });

    await waitFor(() => {
      expect(mockHighlightMap.set).toHaveBeenCalled();
    });

    document.body.removeChild(containerDiv);
  });

  it('gracefully handles absence of CSS Custom Highlight API', async () => {
    delete (window as any).CSS;

    const { result } = renderHook(() => useHighlights('doc-101', 'Some content'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.highlights).toEqual(initialHighlights);
    });
  });
});
