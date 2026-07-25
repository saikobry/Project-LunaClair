import { useState, useEffect, useCallback } from 'react';
import type { DrawingPath } from '../../../shared/types';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage } from '../../../services/storage';

/**
 * Manages freehand drawing paths including localStorage persistence
 * and body scroll-lock when drawing mode is active.
 */
export function useDrawings(isDrawingMode: boolean) {
  const [paths, setPaths] = useState<DrawingPath[]>(() =>
    getFromStorage<DrawingPath[]>(STORAGE_KEYS.PATHS, []),
  );

  // Persist to localStorage whenever paths change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PATHS, paths);
  }, [paths]);

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
    setPaths(newPaths);
  }, []);

  const handleUndo = useCallback(() => {
    setPaths((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const clearDrawings = useCallback(() => {
    setPaths([]);
  }, []);

  return {
    paths,
    handlePathsChange,
    handleUndo,
    clearDrawings,
  };
}
