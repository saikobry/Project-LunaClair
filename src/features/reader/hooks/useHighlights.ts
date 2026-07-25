import { useState, useEffect, useCallback, useRef } from 'react';
import type { HighlightItem, HighlightColor } from '../../../shared/types';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage, removeFromStorage } from '../../../services/storage';
import { restoreRange } from '../../../shared/utils';

/**
 * Manages text highlights including localStorage persistence
 * and CSS Custom Highlight API registration.
 */
export function useHighlights() {
  const [highlights, setHighlights] = useState<HighlightItem[]>(() =>
    getFromStorage<HighlightItem[]>(STORAGE_KEYS.HIGHLIGHTS, []),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Register CSS Custom Highlights when state changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const css = (window as any).CSS;
    if (!css || !css.highlights) return;

    const colorGroups: Record<HighlightColor, Range[]> = {
      yellow: [],
      green: [],
      pink: [],
      blue: [],
    };

    highlights.forEach((hl) => {
      const range = restoreRange(container, hl.start, hl.end);
      if (range) {
        colorGroups[hl.color].push(range);
      }
    });

    (Object.keys(colorGroups) as HighlightColor[]).forEach((color) => {
      const groupName = `hl-${color}`;
      const ranges = colorGroups[color];
      if (ranges.length > 0) {
        css.highlights.set(groupName, new (window as any).Highlight(...ranges));
      } else {
        css.highlights.delete(groupName);
      }
    });
  }, [highlights]);

  // Persist to localStorage whenever highlights change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.HIGHLIGHTS, highlights);
  }, [highlights]);

  const addHighlight = useCallback((start: number, end: number, color: HighlightColor, text: string) => {
    const newHighlight: HighlightItem = {
      id: Math.random().toString(36).substring(2, 9),
      start,
      end,
      color,
      text,
    };
    setHighlights((prev) => [...prev, newHighlight]);
  }, []);

  const deleteHighlight = useCallback((id: string) => {
    setHighlights((prev) => prev.filter((hl) => hl.id !== id));
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlights([]);
    removeFromStorage(STORAGE_KEYS.HIGHLIGHTS);
  }, []);

  return {
    highlights,
    containerRef,
    addHighlight,
    deleteHighlight,
    clearHighlights,
  };
}
