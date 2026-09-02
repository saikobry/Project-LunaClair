import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DrawingPath } from '../../../domain/reader/models/annotation.types';
import { readerQueryKeys } from '../queries/readerQueryKeys';
import { useAnnotationRepository } from './useAnnotationRepository';
import { useSaveDrawings } from './mutations/useSaveDrawings';
import { useClearDrawings } from './mutations/useClearDrawings';

/**
 * Manages freehand drawing paths via TanStack Query + AnnotationRepository.
 * Retains body scroll-lock when drawing mode is active.
 */
export function useDrawings(documentId: string, isDrawingMode: boolean) {
  const annotationRepository = useAnnotationRepository();

  const { data: paths = [] } = useQuery({
    queryKey: readerQueryKeys.drawings(documentId),
    queryFn: ({ signal }) => annotationRepository.getDrawings(documentId, signal),
  });

  const saveMutation = useSaveDrawings();
  const clearMutation = useClearDrawings();

  // Prevent scrolling when in draw mode (especially on mobile)
  useEffect(() => {
    if (isDrawingMode) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
    };
  }, [isDrawingMode]);

  const handlePathsChange = useCallback((newPaths: DrawingPath[]) => {
    saveMutation.mutate({ documentId, paths: newPaths });
  }, [documentId, saveMutation]);

  const handleUndo = useCallback(() => {
    if (paths.length === 0) return;
    saveMutation.mutate({ documentId, paths: paths.slice(0, -1) });
  }, [documentId, paths, saveMutation]);

  const clearDrawings = useCallback(() => {
    clearMutation.mutate(documentId);
  }, [documentId, clearMutation]);

  return {
    paths,
    handlePathsChange,
    handleUndo,
    clearDrawings,
  };
}
