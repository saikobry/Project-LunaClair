import {
  useCallback,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

gsap.registerPlugin(Draggable);

/** Vertical gap between rows — must stay in sync with `styles.list` gap. */
const ROW_GAP = 10;
/** Pointer travel that cancels a pending mobile hold before it activates. */
const HOLD_CANCEL_RADIUS_PX = 8;
/** How long a row must be held before drag starts (mobile, hidden handle). */
const HOLD_DURATION_MS = 280;
/** Drag distance before a new sibling slot is committed (anti-jitter). */
const SLOT_HYSTERESIS_PX = 15;
/** `stroke-dasharray` of the circular hold ring (`2πr`, r = 22). */
const HOLD_RING_CIRCUMFERENCE = 138.23;

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
 * GSAP-backed reordering for a collection's material list.
 *
 * Owns two drag affordances:
 * - `>= 640px` — the visible grip handle (`[data-drag-handle="true"]`).
 * - `< 640px` — a 280ms hold on the row itself, with a circular progress ring
 *   centered on the touch point and a border illumination on the row.
 *
 * Every listener and timer this hook registers is owned by the same layout
 * effect that created it: rows re-register per run, and an in-flight hold is
 * aborted on re-run or unmount so a pending `setTimeout` can never fire against
 * a detached row or leak its window listeners.
 */
export function useCollectionMaterialReorder({
  items,
  setItems,
  onReorder,
}: UseCollectionMaterialReorderOptions): CollectionMaterialReorderApi {
  const listRef = useRef<HTMLDivElement>(null);
  const holdRingRef = useRef<SVGSVGElement>(null);
  const holdCircleRef = useRef<SVGCircleElement>(null);

  const draggablesRef = useRef<Map<string, Draggable>>(new Map());
  const dragOriginIndexRef = useRef(-1);
  const candidateIndexRef = useRef(-1);

  const materialsRef = useRef(items);
  useLayoutEffect(() => {
    materialsRef.current = items;
  });

  useLayoutEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    // Everything this run registers, held locally so the teardown below can
    // release exactly it: row listeners as (element, handler) pairs, and the
    // mobile holds started by this run keyed by pointer id.
    const rowListeners: Array<[HTMLElement, (event: PointerEvent) => void]> = [];
    const holds = new Map<
      number,
      { timer: ReturnType<typeof setTimeout>; cleanup: () => void }
    >();

    const currentIds = new Set(items.map((m) => m.id));
    for (const [id, instance] of Array.from(draggablesRef.current.entries())) {
      if (!currentIds.has(id)) {
        instance.kill();
        draggablesRef.current.delete(id);
      }
    }

    for (const material of items) {
      const materialId = material.id;
      const rowEl = listEl.querySelector<HTMLElement>(`[data-material-id="${materialId}"]`);
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
          onPress(this: Draggable) {
            const indexMap = new Map(materialsRef.current.map((m, idx) => [m.id, idx]));
            const fromIdx = indexMap.get(materialId) ?? -1;
            dragOriginIndexRef.current = fromIdx;
            candidateIndexRef.current = fromIdx;

            gsap.set(rowEl, { zIndex: 100 });
            gsap.to(rowEl, {
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              borderColor: 'var(--color-accent, #a78bfa)',
              duration: 0.15,
              overwrite: 'auto',
            });
          },
          onDrag(this: Draggable) {
            const currentList = materialsRef.current;
            const fromIdx = dragOriginIndexRef.current;
            if (fromIdx === -1) return;

            const listRect = listEl.getBoundingClientRect();
            const rowRect = rowEl.getBoundingClientRect();
            const dragCenterY = rowRect.top - listRect.top + rowRect.height / 2;

            const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-material-id]'));
            if (!rows.length) return;
            const rowHeight = rows[0].offsetHeight || 56;

            const rawCandidate = Math.floor(dragCenterY / (rowHeight + ROW_GAP));
            const candidateIdx = Math.max(0, Math.min(currentList.length - 1, rawCandidate));

            const prevCand = candidateIndexRef.current;
            if (candidateIdx !== prevCand) {
              const prevCenterY = prevCand * (rowHeight + ROW_GAP) + rowHeight / 2;
              const dist = Math.abs(dragCenterY - prevCenterY);
              if (dist < SLOT_HYSTERESIS_PX) return;
              candidateIndexRef.current = candidateIdx;
            }

            const toIdx = candidateIndexRef.current;

            currentList.forEach((m, i) => {
              const currentMaterialId = m.id;
              if (currentMaterialId === materialId) return;
              const siblingEl = listEl.querySelector<HTMLElement>(`[data-material-id="${currentMaterialId}"]`);
              if (!siblingEl) return;

              let newSlot = i;
              if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
                newSlot = i - 1;
              } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
                newSlot = i + 1;
              }

              const dy = (newSlot - i) * (rowHeight + ROW_GAP);
              gsap.to(siblingEl, {
                y: dy,
                duration: 0.3,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            });
          },
          onRelease(this: Draggable) {
            rowEl.style.touchAction = '';
            const fromIdx = dragOriginIndexRef.current;
            const toIdx = candidateIndexRef.current;
            const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-material-id]'));
            const rowHeight = rows[0]?.offsetHeight || 56;

            if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
              const finalDy = (toIdx - fromIdx) * (rowHeight + ROW_GAP);

              gsap.to(rowEl, {
                y: finalDy,
                boxShadow: 'none',
                borderColor: 'var(--color-border)',
                duration: 0.2,
                ease: 'power2.out',
                overwrite: 'auto',
                onComplete: () => {
                  const next = [...materialsRef.current];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);

                  // Update internal state immediately so React reconciles DOM into target order
                  setItems(next);
                  onReorder?.(next.map((m) => m.id));

                  const allRows = listEl.querySelectorAll<HTMLElement>('[data-material-id]');
                  gsap.killTweensOf(allRows, 'y');
                  requestAnimationFrame(() => {
                    allRows.forEach((r) => gsap.set(r, { clearProps: 'zIndex,y,boxShadow,borderColor,backgroundColor' }));
                  });
                },
              });
            } else {
              gsap.to(rowEl, {
                y: 0,
                boxShadow: 'none',
                borderColor: 'var(--color-border)',
                duration: 0.15,
                ease: 'power2.out',
                overwrite: 'auto',
                onComplete: () => {
                  gsap.set(rowEl, { clearProps: 'zIndex,y,boxShadow,borderColor,backgroundColor' });
                },
              });
            }
          },
        });
        draggablesRef.current.set(materialId, instance);
      }

      // Attach hold-to-drag on the row container when the drag handle is hidden (mobile)
      const onPointerDown = (e: PointerEvent) => {
        const hEl = rowEl.querySelector<HTMLElement>('[data-drag-handle="true"]');
        const isHandleVisible = hEl && window.getComputedStyle(hEl).display !== 'none';
        if (isHandleVisible) return;

        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, [role="button"]')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const pointerId = e.pointerId;

        let holdTimer: ReturnType<typeof setTimeout> | null = null;
        let isSettled = false;

        const ringEl = holdRingRef.current;
        const circleEl = holdCircleRef.current;

        const detachWindowListeners = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
        };

        // A `function` declaration so the hold can be registered before the ring
        // animation starts: an unmount mid-hold must cancel the pending timer
        // and detach the window listeners below.
        function cleanupHold(completed = false) {
          if (isSettled) return;
          isSettled = true;
          holds.delete(pointerId);

          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
          detachWindowListeners();

          if (ringEl && circleEl) {
            gsap.killTweensOf([ringEl, circleEl]);
            if (completed) {
              gsap.to(ringEl, {
                scale: 1.35,
                opacity: 0,
                duration: 0.16,
                ease: 'power2.out',
                onComplete: () => {
                  gsap.set(ringEl, { display: 'none' });
                },
              });
            } else {
              gsap.to(ringEl, {
                scale: 0.8,
                opacity: 0,
                duration: 0.1,
                ease: 'power2.in',
                onComplete: () => {
                  gsap.set(ringEl, { display: 'none' });
                },
              });
              gsap.to(rowEl, {
                borderColor: 'var(--color-border)',
                duration: 0.15,
                overwrite: 'auto',
              });
            }
          }
        }

        const onPointerMove = (moveEvt: PointerEvent) => {
          if (Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY) > HOLD_CANCEL_RADIUS_PX) {
            cleanupHold(false);
          }
        };

        const onPointerUp = () => {
          cleanupHold(false);
        };

        // Position circular progress ring centered at the touch point
        if (ringEl && circleEl) {
          const listRect = listEl.getBoundingClientRect();
          const touchX = e.clientX - listRect.left;
          const touchY = e.clientY - listRect.top;

          gsap.killTweensOf([ringEl, circleEl]);
          gsap.set(ringEl, {
            left: touchX,
            top: touchY,
            scale: 0.85,
            opacity: 0,
            display: 'block',
          });
          gsap.to(ringEl, {
            scale: 1,
            opacity: 1,
            duration: 0.12,
            ease: 'power2.out',
            overwrite: 'auto',
          });
          gsap.fromTo(
            circleEl,
            { strokeDashoffset: HOLD_RING_CIRCUMFERENCE },
            {
              strokeDashoffset: 0,
              duration: HOLD_DURATION_MS / 1000,
              ease: 'power1.inOut',
              overwrite: 'auto',
            },
          );
        }

        // Subtle illumination of the card border only. The row background
        // stays the solid surface color so the row never looks transparent
        // while (or after) dragging on mobile.
        gsap.to(rowEl, {
          borderColor: 'rgba(167, 139, 250, 0.5)',
          duration: 0.2,
          overwrite: 'auto',
        });

        holdTimer = setTimeout(() => {
          cleanupHold(true);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(30);
            } catch {}
          }
          rowEl.style.touchAction = 'none';
          try {
            rowEl.setPointerCapture?.(pointerId);
          } catch {}

          const currentDraggable = draggablesRef.current.get(materialId);
          if (currentDraggable) {
            currentDraggable.startDrag(e);
          }
        }, HOLD_DURATION_MS);

        holds.set(pointerId, { timer: holdTimer, cleanup: () => cleanupHold(false) });

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerUp, { passive: true });
        window.addEventListener('pointercancel', onPointerUp, { passive: true });
      };

      rowEl.addEventListener('pointerdown', onPointerDown);
      rowListeners.push([rowEl, onPointerDown]);
    }

    // Cancel every hold this run started: clear the pending timer, then detach
    // its window listeners and reset the row's visuals.
    const cancelPendingHolds = () => {
      for (const hold of Array.from(holds.values())) {
        const timer = hold.timer;
        clearTimeout(timer);
        hold.cleanup();
      }
      holds.clear();
    };

    // Ownership: release every listener and in-flight hold registered by this
    // run, so a re-run or unmount cannot leave a pending timer or dangling
    // window listener behind.
    return () => {
      for (const [rowEl, handler] of rowListeners) {
        rowEl.removeEventListener('pointerdown', handler);
      }
      rowListeners.length = 0;
      cancelPendingHolds();
    };
  }, [items, onReorder, setItems]);

  // Draggable instances and their GSAP tweens outlive individual runs, so they
  // are torn down once, on unmount.
  useLayoutEffect(() => {
    const draggables = draggablesRef.current;
    const ringEl = holdRingRef.current;
    const circleEl = holdCircleRef.current;
    return () => {
      if (ringEl) gsap.killTweensOf(ringEl);
      if (circleEl) gsap.killTweensOf(circleEl);
      for (const instance of draggables.values()) {
        instance.kill();
      }
      draggables.clear();
    };
  }, []);

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
