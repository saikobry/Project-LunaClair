import { useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HighlightItem, HighlightColor } from '../../../domain/reader';
import { restoreRange } from '../utils/selection';
import { readerQueryKeys } from '../queries/readerQueryKeys';
import { useAnnotationRepository } from './useAnnotationRepository';
import { useSaveHighlights } from './mutations/useSaveHighlights';
import { useDeleteHighlight } from './mutations/useDeleteHighlight';
import { useClearHighlights } from './mutations/useClearHighlights';

/**
 * Manages text highlights via TanStack Query + AnnotationRepository.
 * Retains CSS Custom Highlight API registration for rendering.
 *
 * @param documentId - The material/document ID for annotation scoping.
 * @param content - The rendered markdown content string. Used as an effect
 *   dependency so highlights re-register once the DOM has text nodes.
 */
export function useHighlights(documentId: string, content: string) {
  const annotationRepository = useAnnotationRepository();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { data: highlights = [] } = useQuery({
    queryKey: readerQueryKeys.highlights(documentId),
    queryFn: ({ signal }) => annotationRepository.getHighlights(documentId, signal),
  });

  const saveMutation = useSaveHighlights();
  const deleteMutation = useDeleteHighlight();
  const clearMutation = useClearHighlights();

  // Register CSS Custom Highlights when data or rendered content changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !content) return;

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
  }, [highlights, content]);

  const addHighlight = useCallback((start: number, end: number, color: HighlightColor, text: string) => {
    const newHighlight: HighlightItem = {
      id: Math.random().toString(36).substring(2, 9),
      start,
      end,
      color,
      text,
    };
    saveMutation.mutate({ documentId, highlights: [...highlights, newHighlight] });
  }, [documentId, highlights, saveMutation]);

  const deleteHighlight = useCallback((id: string) => {
    deleteMutation.mutate({ documentId, highlightId: id });
  }, [documentId, deleteMutation]);

  const clearHighlights = useCallback(() => {
    clearMutation.mutate(documentId);
  }, [documentId, clearMutation]);

  return {
    highlights,
    containerRef,
    addHighlight,
    deleteHighlight,
    clearHighlights,
  };
}
