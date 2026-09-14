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
 * - `>= 640px` — the visible grip handle (`[data-drag-handle="true"]`),
 *   driven by a GSAP `Draggable` per row.
 * - `< 640px` — a 280ms hold on the row itself, with a circular progress ring
 *   centered on the touch point and a border illumination on the row. The
 *   post-hold drag is driven manually with Pointer Events (not
 *   `Draggable.startDrag`): a programmatic start from the stale press event
 *   leaves GSAP listening for the wrong move events (touch-only for a mouse,
 *   scroll-claimed for touch), so the card never follows the pointer. Manual
 *   tracking works uniformly for mouse/touch/pen, and a non-passive
 *   `touchmove` lock suppresses native scrolling while armed.
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

    // Armed manual drags (mobile hold path) owned by this run, so unmount or
    // re-run detaches their window listeners and scroll locks.
    const armedTeardowns: Array<() => void> = [];

    /** Live row metrics: first-row height stands in for the uniform row height. */
    const rowMetrics = () => {
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-material-id]'));
      return { rows, rowHeight: rows[0]?.offsetHeight || 56 };
    };

    /** Slot index for a drag-center Y, with hysteresis against the last slot. */
    const candidateForCenter = (centerY: number, rowHeight: number, count: number, prev: number) => {
      const raw = Math.floor(centerY / (rowHeight + ROW_GAP));
      const idx = Math.max(0, Math.min(count - 1, raw));
      if (idx !== prev) {
        const prevCenterY = prev * (rowHeight + ROW_GAP) + rowHeight / 2;
        if (Math.abs(centerY - prevCenterY) < SLOT_HYSTERESIS_PX) return prev;
      }
      return idx;
    };

    /** Pushes every sibling toward the slot freed by a `fromIdx -> toIdx` move. */
    const displaceSiblings = (materialId: string, fromIdx: number, toIdx: number, rowHeight: number) => {
      materialsRef.current.forEach((m, i) => {
        if (m.id === materialId) return;
        const siblingEl = listEl.querySelector<HTMLElement>(`[data-material-id="${m.id}"]`);
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
    };

    /** Commits a finished drag (or snaps back) and clears every row transform. */
    const settleRow = (rowEl: HTMLElement, fromIdx: number, toIdx: number, rowHeight: number) => {
      if (!rowEl.isConnected) return;
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
    };

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
            const fromIdx = dragOriginIndexRef.current;
            if (fromIdx === -1) return;

            const { rowHeight } = rowMetrics();
            const listRect = listEl.getBoundingClientRect();
            const rowRect = rowEl.getBoundingClientRect();
            const dragCenterY = rowRect.top - listRect.top + rowRect.height / 2;

            candidateIndexRef.current = candidateForCenter(
              dragCenterY,
              rowHeight,
              materialsRef.current.length,
              candidateIndexRef.current,
            );
            displaceSiblings(materialId, fromIdx, candidateIndexRef.current, rowHeight);
          },
          onRelease(this: Draggable) {
            rowEl.style.touchAction = '';
            const { rowHeight } = rowMetrics();
            settleRow(rowEl, dragOriginIndexRef.current, candidateIndexRef.current, rowHeight);
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
          if (!rowEl.isConnected) {
            cleanupHold(false);
            return;
          }
          cleanupHold(true);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(30);
            } catch {}
          }

          // Manual armed drag: Pointer Events track mouse/touch/pen uniformly
          // from the live gesture (GSAP cannot — see the hook comment).
          const indexMap = new Map(materialsRef.current.map((m, idx) => [m.id, idx]));
          const fromIdx = indexMap.get(materialId) ?? -1;
          if (fromIdx === -1) return;
          let armedIdx = fromIdx;
          const startY = e.clientY;
          // Hoisted `function` handlers below lose the outer narrowing, so pin
          // non-null locals for them.
          const armedRow: HTMLElement = rowEl;
          const armedList: HTMLDivElement = listEl;

          gsap.set(rowEl, { zIndex: 100 });
          gsap.to(rowEl, {
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            borderColor: 'var(--color-accent, #a78bfa)',
            duration: 0.15,
            overwrite: 'auto',
          });

          rowEl.style.touchAction = 'none';
          try {
            rowEl.setPointerCapture?.(pointerId);
          } catch {}

          // The press predates the takeover, so `touch-action` alone cannot be
          // trusted mid-gesture: suppress native scrolling while armed.
          const stopScroll = (touchEvt: TouchEvent) => {
            touchEvt.preventDefault();
          };
          window.addEventListener('touchmove', stopScroll, { passive: false });

          let armedDone = false;
          function teardownArmed() {
            if (armedDone) return;
            armedDone = true;
            window.removeEventListener('pointermove', onArmedMove);
            window.removeEventListener('pointerup', onArmedUp);
            window.removeEventListener('pointercancel', onArmedCancel);
            window.removeEventListener('touchmove', stopScroll);
            armedRow.style.touchAction = '';
          }
          armedTeardowns.push(teardownArmed);

          function finishArmed(commit: boolean) {
            teardownArmed();
            const { rowHeight } = rowMetrics();
            settleRow(armedRow, fromIdx, commit ? armedIdx : fromIdx, rowHeight);
          }

          function onArmedMove(moveEvt: PointerEvent) {
            if (moveEvt.pointerId !== pointerId || !armedRow.isConnected) return;
            gsap.set(armedRow, { y: moveEvt.clientY - startY });
            const { rowHeight } = rowMetrics();
            const listRect = armedList.getBoundingClientRect();
            const rowRect = armedRow.getBoundingClientRect();
            const centerY = rowRect.top - listRect.top + rowRect.height / 2;
            armedIdx = candidateForCenter(centerY, rowHeight, materialsRef.current.length, armedIdx);
            displaceSiblings(materialId, fromIdx, armedIdx, rowHeight);
          }

          function onArmedUp(upEvt: PointerEvent) {
            if (upEvt.pointerId !== pointerId) return;
            finishArmed(true);
          }

          function onArmedCancel() {
            finishArmed(false);
          }

          window.addEventListener('pointermove', onArmedMove, { passive: true });
          window.addEventListener('pointerup', onArmedUp);
          window.addEventListener('pointercancel', onArmedCancel);
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
      for (const teardown of armedTeardowns.splice(0)) teardown();
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
