import { useLayoutEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import {
  DRAG_LIFT_SHADOW,
  candidateForCenter,
  displaceSiblings,
  findRow,
  measureRows,
  settleRow,
} from '../utils/reorderListGeometry';

gsap.registerPlugin(Draggable);

/**
 * Desktop (`>= 640px`) drag path: one GSAP `Draggable` per row, triggered by the
 * visible grip handle.
 *
 * Instances outlive individual effect runs — a row keeps its instance across
 * re-renders and is only killed when its material leaves the list or the list
 * unmounts — so callbacks are read through refs rather than captured once, which
 * would pin the first render's callbacks for the life of the row.
 */
export function useDesktopRowDrag({
  items,
  listRef,
  orderRef,
  onCommit,
}: {
  items: { id: string }[];
  listRef: RefObject<HTMLDivElement | null>;
  /** Live order, kept fresh by the orchestrator so callbacks never read a stale list. */
  orderRef: RefObject<{ id: string }[]>;
  onCommit: (fromIdx: number, toIdx: number) => void;
}): void {
  const draggablesRef = useRef<Map<string, Draggable>>(new Map());
  const dragOriginIndexRef = useRef(-1);
  const candidateIndexRef = useRef(-1);

  const onCommitRef = useRef(onCommit);
  useLayoutEffect(() => {
    onCommitRef.current = onCommit;
  });

  useLayoutEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    // Drop instances whose material is no longer in the list.
    const currentIds = new Set(items.map((m) => m.id));
    for (const [id, instance] of Array.from(draggablesRef.current.entries())) {
      if (!currentIds.has(id)) {
        instance.kill();
        draggablesRef.current.delete(id);
      }
    }

    for (const material of items) {
      const materialId = material.id;
      const rowEl = findRow(listEl, materialId);
      if (!rowEl) continue;
      const handleEl = rowEl.querySelector<HTMLElement>('[data-drag-handle="true"]');
      if (!handleEl) continue;

      let instance = Draggable.get(rowEl) as Draggable | undefined;
      if (!instance) {
        [instance] = Draggable.create(rowEl, {
          trigger: handleEl,
          type: 'y',
          lockAxis: true,
          zIndexBoost: false,
          cursor: 'grab',
          activeCursor: 'grabbing',
          onPress() {
            const indexMap = new Map(orderRef.current.map((m, idx) => [m.id, idx]));
            const fromIdx = indexMap.get(materialId) ?? -1;
            dragOriginIndexRef.current = fromIdx;
            candidateIndexRef.current = fromIdx;

            gsap.set(rowEl, { zIndex: 100 });
            gsap.to(rowEl, {
              boxShadow: DRAG_LIFT_SHADOW,
              borderColor: 'var(--color-accent)',
              duration: 0.15,
              overwrite: 'auto',
            });
          },
          onDrag() {
            const fromIdx = dragOriginIndexRef.current;
            if (fromIdx === -1) return;

            const { rowHeight } = measureRows(listEl);
            const listRect = listEl.getBoundingClientRect();
            const rowRect = rowEl.getBoundingClientRect();
            const dragCenterY = rowRect.top - listRect.top + rowRect.height / 2;

            candidateIndexRef.current = candidateForCenter(
              dragCenterY,
              rowHeight,
              orderRef.current.length,
              candidateIndexRef.current,
            );
            displaceSiblings({
              listEl,
              order: orderRef.current,
              draggedId: materialId,
              fromIdx,
              toIdx: candidateIndexRef.current,
              rowHeight,
            });
          },
          onRelease() {
            rowEl.style.touchAction = '';
            const { rowHeight } = measureRows(listEl);
            settleRow({
              listEl,
              rowEl,
              fromIdx: dragOriginIndexRef.current,
              toIdx: candidateIndexRef.current,
              rowHeight,
              onCommit: (from, to) => onCommitRef.current(from, to),
            });
          },
        });
        draggablesRef.current.set(materialId, instance);
      }
    }
  }, [items, listRef, orderRef]);

  // Draggable instances and their tweens outlive individual runs, so they are
  // torn down once, on unmount.
  useLayoutEffect(() => {
    const draggables = draggablesRef.current;
    return () => {
      for (const instance of draggables.values()) {
        instance.kill();
      }
      draggables.clear();
    };
  }, []);
}
