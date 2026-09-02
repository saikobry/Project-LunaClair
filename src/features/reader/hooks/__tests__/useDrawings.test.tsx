import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDrawings } from '../useDrawings';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { DrawingPath } from '../../../../domain/reader/models/annotation.types';

describe('useDrawings', () => {
  let queryClient: QueryClient;
  let mockAnnotationRepo: any;
  let mockSaveDrawingUseCase: any;
  let mockClearAnnotationsUseCase: any;
  let mockContext: any;

  const initialPaths: DrawingPath[] = [
    {
      id: 'path-1',
      color: '#ef4444',
      thickness: 4,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.15, y: 0.25 },
      ],
    },
    {
      id: 'path-2',
      color: '#3b82f6',
      thickness: 8,
      points: [
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.6 },
      ],
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
      getHighlights: vi.fn().mockResolvedValue([]),
      saveHighlights: vi.fn().mockResolvedValue(undefined),
      clearHighlights: vi.fn().mockResolvedValue(undefined),
      getDrawings: vi.fn().mockResolvedValue(initialPaths),
      saveDrawings: vi.fn().mockResolvedValue(undefined),
      clearDrawings: vi.fn().mockResolvedValue(undefined),
    };

    mockSaveDrawingUseCase = {
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
          saveDrawing: mockSaveDrawingUseCase,
          clearAnnotations: mockClearAnnotationsUseCase,
        },
      },
    };

    // Reset document body styles
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    </QueryClientProvider>
  );

  it('fetches initial drawing paths for documentId from annotation repository', async () => {
    const { result } = renderHook(() => useDrawings('doc-101', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paths).toEqual(initialPaths);
    });

    expect(mockAnnotationRepo.getDrawings).toHaveBeenCalledWith('doc-101', expect.anything());
  });

  it('locks body scroll when isDrawingMode is true and unlocks when toggled off', () => {
    const { rerender } = renderHook(
      ({ isDrawingMode }) => useDrawings('doc-101', isDrawingMode),
      {
        wrapper: createWrapper(),
        initialProps: { isDrawingMode: true },
      },
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');
    expect(document.body.style.overscrollBehavior).toBe('none');

    rerender({ isDrawingMode: false });

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
  });

  it('restores body scroll styles when unmounting in drawing mode', () => {
    const { unmount } = renderHook(() => useDrawings('doc-101', true), {
      wrapper: createWrapper(),
    });

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
  });

  it('saves new paths through handlePathsChange mutation', async () => {
    const { result } = renderHook(() => useDrawings('doc-101', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paths).toHaveLength(2);
    });

    const newPath: DrawingPath = {
      id: 'path-3',
      color: '#10b981',
      thickness: 2,
      points: [{ x: 0.2, y: 0.3 }],
    };

    act(() => {
      result.current.handlePathsChange([...initialPaths, newPath]);
    });

    await waitFor(() => {
      expect(mockSaveDrawingUseCase.execute).toHaveBeenCalledWith(
        'doc-101',
        [...initialPaths, newPath],
      );
    });
  });

  it('handles undo by popping the last stroke path from paths stack', async () => {
    const { result } = renderHook(() => useDrawings('doc-101', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paths).toHaveLength(2);
    });

    act(() => {
      result.current.handleUndo();
    });

    await waitFor(() => {
      expect(mockSaveDrawingUseCase.execute).toHaveBeenCalledWith(
        'doc-101',
        [initialPaths[0]],
      );
    });
  });

  it('does nothing on handleUndo when paths array is empty', async () => {
    mockAnnotationRepo.getDrawings.mockResolvedValue([]);

    const { result } = renderHook(() => useDrawings('doc-empty', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paths).toEqual([]);
    });

    act(() => {
      result.current.handleUndo();
    });

    expect(mockSaveDrawingUseCase.execute).not.toHaveBeenCalled();
  });

  it('clears all drawings and triggers clearAnnotations use case with drawings type', async () => {
    const { result } = renderHook(() => useDrawings('doc-101', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paths).toHaveLength(2);
    });

    act(() => {
      result.current.clearDrawings();
    });

    await waitFor(() => {
      expect(mockClearAnnotationsUseCase.execute).toHaveBeenCalledWith('doc-101', 'drawings');
    });
  });
});
