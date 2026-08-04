import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

export interface DragReorderState {
    /** Index of the item currently being dragged. */
    dragIndex: number | null;
    /** Index of the item the dragged item is hovering over. */
    overIndex: number | null;
}

export interface UseDragReorderOptions {
    /** Number of reorderable items. */
    itemCount: number;
    /** Called with (from, to) when a drop commits a reorder. */
    onReorder: (from: number, to: number) => void;
}

export interface UseDragReorderResult {
    state: DragReorderState;
    /** Spread onto the drag-handle element of each item. */
    getHandleProps: (index: number) => {
        draggable: boolean;
        onDragStart: (event: DragEvent) => void;
        onDragEnd: () => void;
    };
    /** Spread onto each list item container. */
    getItemProps: (index: number) => {
        onDragOver: (event: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: (event: DragEvent) => void;
    };
    /** Keyboard fallback: move an item one slot up. */
    moveUp: (index: number) => void;
    /** Keyboard fallback: move an item one slot down. */
    moveDown: (index: number) => void;
}

/**
 * Generic drag-and-drop reordering hook.
 *
 * Drives HTML5 drag-and-drop from a dedicated handle grip and exposes
 * `moveUp`/`moveDown` as keyboard-accessible fallbacks. Domain-neutral —
 * the consumer owns item state and commits reorders via `onReorder`.
 */
export function useDragReorder({ itemCount, onReorder }: UseDragReorderOptions): UseDragReorderResult {
    const [state, setState] = useState<DragReorderState>({ dragIndex: null, overIndex: null });
    const dragIndexRef = useRef<number | null>(null);

    const reset = useCallback(() => {
        dragIndexRef.current = null;
        setState({ dragIndex: null, overIndex: null });
    }, []);

    const commit = useCallback((from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= itemCount || to >= itemCount) return;
        onReorder(from, to);
    }, [itemCount, onReorder]);

    const getHandleProps = useCallback((index: number) => ({
        draggable: true,
        onDragStart: (event: DragEvent) => {
            event.dataTransfer.effectAllowed = 'move';
            dragIndexRef.current = index;
            setState({ dragIndex: index, overIndex: null });
        },
        onDragEnd: reset,
    }), [reset]);

    const getItemProps = useCallback((index: number) => ({
        onDragOver: (event: DragEvent) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setState((prev) => (prev.overIndex === index ? prev : { ...prev, overIndex: index }));
        },
        onDragLeave: () => {
            setState((prev) => (prev.overIndex === index ? { ...prev, overIndex: null } : prev));
        },
        onDrop: (event: DragEvent) => {
            event.preventDefault();
            const from = dragIndexRef.current;
            if (from != null) commit(from, index);
            dragIndexRef.current = null;
            setState({ dragIndex: null, overIndex: null });
        },
    }), [commit]);

    const moveUp = useCallback((index: number) => {
        commit(index, index - 1);
    }, [commit]);

    const moveDown = useCallback((index: number) => {
        commit(index, index + 1);
    }, [commit]);

    return { state, getHandleProps, getItemProps, moveUp, moveDown };
}
