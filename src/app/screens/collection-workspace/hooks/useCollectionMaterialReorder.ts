import { useCallback, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { useDesktopRowDrag } from './useDesktopRowDrag';
import { useHoldToDragArming } from './useHoldToDragArming';

export interface CollectionMaterialReorderApi {
  /** Attach to the list container. */
  listRef: RefObject<HTMLDivElement | null>;
  /** Attach to the hold-to-drag progress ring `<svg>`. */
  holdRingRef: RefObject<SVGSVGElement | null>;
  /** Attach to the ring's progress `<circle>`. */
  holdCircleRef: RefObject<SVGCircleElement | null>;
  /** Keyboard / arrow-button reordering. `direction` is ±1. */
  moveItem: (index: number, direction: -1 | 1) => void;
}

interface UseCollectionMaterialReorderOptions {
  items: StudyMaterial[];
  setItems: Dispatch<SetStateAction<StudyMaterial[]>>;
  onReorder?: (orderedMaterialIds: string[]) => void;
}

/**
 * Reordering for a collection's material list.
 *
 * Thin orchestrator over three concerns, split so each is independently
 * reviewable and the slot math is testable without a DOM gesture:
 * - `reorderListGeometry` — slot/candidate math, sibling displacement, landing
 *   snap, and the shared commit hand-off.
 * - `useDesktopRowDrag` — the `>= 640px` grip-handle path (`gsap` `Draggable`).
 * - `useHoldToDragArming` — the `< 640px` 280ms hold-to-arm pointer path.
 *
 * The hook owns only the refs the DOM contract requires, the live `items`
 * mirror, and the optimistic order mutation both gesture paths commit through.
 */
export function useCollectionMaterialReorder({
  items,
  setItems,
  onReorder,
}: UseCollectionMaterialReorderOptions): CollectionMaterialReorderApi {
  const listRef = useRef<HTMLDivElement>(null);
  const holdRingRef = useRef<SVGSVGElement>(null);
  const holdCircleRef = useRef<SVGCircleElement>(null);

  const orderRef = useRef(items);
  useLayoutEffect(() => {
    orderRef.current = items;
  });

  /**
   * Applies a finished drag to local state and reports the new order. Optimistic
   * by design: the reordered list renders before the mutation settles.
   */
  const commitReorder = useCallback(
    (fromIdx: number, toIdx: number) => {
      const next = [...orderRef.current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);

      setItems(next);
      onReorder?.(next.map((m) => m.id));
    },
    [setItems, onReorder],
  );

  useDesktopRowDrag({ items, listRef, orderRef, onCommit: commitReorder });
  useHoldToDragArming({
    items,
    listRef,
    holdRingRef,
    holdCircleRef,
    orderRef,
    onCommit: commitReorder,
  });

  const moveItem = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const next = [...items];
      const displaced = next[target];
      next[target] = next[index];
      next[index] = displaced;
      setItems(next);
      onReorder?.(next.map((m) => m.id));
    },
    [items, onReorder, setItems],
  );

  return { listRef, holdRingRef, holdCircleRef, moveItem };
}
