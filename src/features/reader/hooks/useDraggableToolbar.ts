import { useState, useRef, type RefObject } from 'react';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

export interface ToolbarPosition {
  side: 'left' | 'right';
  y: number;
}

/**
 * Manages pointer-capture dragging, desktop sidebar boundary clamping,
 * magnetic edge snapping, and persistent positioning for the AnnotationToolbar.
 */
export function useDraggableToolbar(
  toolbarRef: RefObject<HTMLDivElement | null>,
  isMobileOrTablet: boolean,
  focusMode: boolean,
) {
  const [savedPosition, setSavedPosition] = useState<ToolbarPosition>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.reader.toolbarPosition);
      if (stored) {
        const parsed = JSON.parse(stored);
        if ((parsed?.side === 'left' || parsed?.side === 'right') && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { side: 'left', y: 100 };
  });

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobileOrTablet || e.button !== 0) return;
    // Don't initiate drag if clicking an interactive control
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }

    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    try {
      toolbar.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = toolbar.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    };
    setDragOffset({ x: rect.left, y: rect.top });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const toolbar = toolbarRef.current;
    const width = toolbar?.offsetWidth ?? 48;
    const height = toolbar?.offsetHeight ?? 200;

    // Desktop sidebar occupies 240px unless Focus Mode is active
    const sidebarOffset = focusMode ? 0 : 240;
    const minX = sidebarOffset + 12;
    const maxX = Math.max(minX, window.innerWidth - width - 12);
    const minY = 12;
    const maxY = Math.max(minY, window.innerHeight - height - 12);

    const newX = Math.max(minX, Math.min(maxX, dragStartRef.current.startX + deltaX));
    const newY = Math.max(minY, Math.min(maxY, dragStartRef.current.startY + deltaY));

    setDragOffset({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    setIsDragging(false);

    try {
      toolbarRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const toolbar = toolbarRef.current;
    const currentX = dragOffset?.x ?? dragStartRef.current.startX;
    const currentY = dragOffset?.y ?? dragStartRef.current.startY;
    const toolbarWidth = toolbar?.offsetWidth ?? 48;
    const toolbarHeight = toolbar?.offsetHeight ?? 200;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Determine side relative to the main content area (excluding the sidebar)
    const sidebarOffset = focusMode ? 0 : 240;
    const availableWidth = windowWidth - sidebarOffset;
    const centerX = currentX + toolbarWidth / 2;
    const side: 'left' | 'right' = centerX < sidebarOffset + availableWidth / 2 ? 'left' : 'right';

    const minY = 16;
    const maxY = Math.max(minY, windowHeight - toolbarHeight - 16);
    const clampedY = Math.max(minY, Math.min(maxY, currentY));

    const newPos: ToolbarPosition = { side, y: clampedY };
    setSavedPosition(newPos);
    setDragOffset(null);
    dragStartRef.current = null;

    try {
      localStorage.setItem(STORAGE_KEYS.reader.toolbarPosition, JSON.stringify(newPos));
    } catch {
      // ignore
    }
  };

  const getPositionStyles = (): React.CSSProperties => {
    if (isDragging && dragOffset) {
      return {
        left: `${dragOffset.x}px`,
        top: `${dragOffset.y}px`,
        right: 'auto',
        bottom: 'auto',
        transition: 'none',
        cursor: 'grabbing',
      };
    }

    if (!isMobileOrTablet) {
      const isLeft = savedPosition.side === 'left';
      // When sidebar is open, anchor 16px to the right of the 240px sidebar (256px)
      const leftPos = focusMode ? 16 : 240 + 16;
      return {
        left: isLeft ? `${leftPos}px` : 'auto',
        right: isLeft ? 'auto' : '16px',
        top: `${savedPosition.y}px`,
        bottom: 'auto',
        transition:
          'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), right 0.35s cubic-bezier(0.16, 1, 0.3, 1), top 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
        cursor: 'grab',
      };
    }

    return {};
  };

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getPositionStyles,
  };
}
