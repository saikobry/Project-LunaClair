import { useState, useEffect, useCallback, type RefObject } from 'react';
import type { HighlightItem, AnnotationMode } from '../../../domain/reader/models/annotation.types';
import { getOffsetsOfRange } from '../utils/selection';
import type { PopoverState } from '../types/reader.types';

/**
 * Listens to selectionchange events on the document and manages
 * the SelectionPopover position, visibility, and pending selection data.
 */
export function useTextSelection(
  mode: AnnotationMode,
  highlights: HighlightItem[],
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const [popover, setPopover] = useState<PopoverState>({
    x: 0,
    y: 0,
    visible: false,
  });

  const handleTextSelection = useCallback(() => {
    if (mode !== 'select') return;
    const container = containerRef.current;
    if (!container) return;

    const selection = window.getSelection();

    // 1. If selection is collapsed (regular click / cursor position)
    if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const offsets = getOffsetsOfRange(range, container);
        if (offsets) {
          // Check if cursor click falls inside any highlight
          const clickedHl = highlights.find(
            (hl) => offsets.start >= hl.start && offsets.start <= hl.end,
          );
          if (clickedHl) {
            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setPopover({
              x: rect.left + rect.width / 2 - containerRect.left,
              y: rect.top - containerRect.top,
              visible: true,
              targetHighlightId: clickedHl.id,
            });
            return;
          }
        }
      }

      // If we clicked elsewhere, close selection popover
      setPopover((prev) =>
        prev.targetHighlightId
          ? { ...prev, visible: false, targetHighlightId: undefined }
          : prev,
      );
      return;
    }

    // 2. If text selection exists (user selected a text range)
    const range = selection.getRangeAt(0);
    const offsets = getOffsetsOfRange(range, container);
    if (!offsets) return;

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPopover({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top,
      visible: true,
      pendingSelection: {
        start: offsets.start,
        end: offsets.end,
        text: selection.toString(),
      },
    });
  }, [mode, highlights, containerRef]);

  // Register selection listener
  useEffect(() => {
    const onSelectionChange = () => {
      handleTextSelection();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [handleTextSelection]);

  return { popover, setPopover };
}
