import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import {
  DRAG_LIFT_SHADOW,
  candidateForCenter,
  displaceSiblings,
  findRow,
  measureRows,
  settleRow,
} from '../utils/reorderListGeometry';

/** Pointer travel that cancels a pending mobile hold before it activates. */
const HOLD_CANCEL_RADIUS_PX = 8;
/** How long a row must be held before drag starts (mobile, hidden handle). */
const HOLD_DURATION_MS = 280;
/** `stroke-dasharray` of the circular hold ring (`2πr`, r = 22). */
const HOLD_RING_CIRCUMFERENCE = 138.23;

/**
 * Mobile (`< 640px`) drag path: holding a row for `HOLD_DURATION_MS` arms a
 * manual Pointer Events drag, with a circular progress ring centered on the
 * touch point and a border illumination on the row.
 *
 * The post-hold drag is driven manually rather than by `Draggable.startDrag`:
 * a programmatic start from the stale press event leaves GSAP listening for the
 * wrong move events (touch-only for a mouse, scroll-claimed for touch), so the
 * card never follows the pointer. Manual tracking works uniformly for
 * mouse/touch/pen, and a non-passive `touchmove` lock suppresses native
 * scrolling while armed.
 *
 * Every listener and timer this hook registers is owned by the same layout
 * effect that created it: rows re-register per run, and an in-flight hold is
 * aborted on re-run or unmount so a pending `setTimeout` can never fire against
 * a detached row or leak its window listeners.
 */
export function useHoldToDragArming({
  items,
  listRef,
  holdRingRef,
  holdCircleRef,
  orderRef,
  onCommit,
}: {
  items: { id: string }[];
  listRef: RefObject<HTMLDivElement | null>;
  holdRingRef: RefObject<SVGSVGElement | null>;
  holdCircleRef: RefObject<SVGCircleElement | null>;
  /** Live order, kept fresh by the orchestrator so callbacks never read a stale list. */
  orderRef: RefObject<{ id: string }[]>;
  onCommit: (fromIdx: number, toIdx: number) => void;
}): void {
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

    // Armed manual drags (mobile hold path) owned by this run, so unmount or
    // re-run detaches their window listeners and scroll locks.
    const armedTeardowns: Array<() => void> = [];

    const commit = (fromIdx: number, toIdx: number) => onCommit(fromIdx, toIdx);

    for (const material of items) {
      const materialId = material.id;
      const rowEl = findRow(listEl, materialId);
      if (!rowEl) continue;
      const handleEl = rowEl.querySelector<HTMLElement>('[data-drag-handle="true"]');
      if (!handleEl) continue;

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
          if (
            Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY) >
            HOLD_CANCEL_RADIUS_PX
          ) {
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
          borderColor: 'color-mix(in srgb, var(--color-accent) 50%, transparent)',
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
          const indexMap = new Map(orderRef.current.map((m, idx) => [m.id, idx]));
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
            boxShadow: DRAG_LIFT_SHADOW,
            borderColor: 'var(--color-accent)',
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

          function finishArmed(commitDrag: boolean) {
            teardownArmed();
            const { rowHeight } = measureRows(armedList);
            settleRow({
              listEl: armedList,
              rowEl: armedRow,
              fromIdx,
              toIdx: commitDrag ? armedIdx : fromIdx,
              rowHeight,
              onCommit: commit,
            });
          }

          function onArmedMove(moveEvt: PointerEvent) {
            if (moveEvt.pointerId !== pointerId || !armedRow.isConnected) return;
            gsap.set(armedRow, { y: moveEvt.clientY - startY });
            const { rowHeight } = measureRows(armedList);
            const listRect = armedList.getBoundingClientRect();
            const rowRect = armedRow.getBoundingClientRect();
            const centerY = rowRect.top - listRect.top + rowRect.height / 2;
            armedIdx = candidateForCenter(
              centerY,
              rowHeight,
              orderRef.current.length,
              armedIdx,
            );
            displaceSiblings({
              listEl: armedList,
              order: orderRef.current,
              draggedId: materialId,
              fromIdx,
              toIdx: armedIdx,
              rowHeight,
            });
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
  }, [items, listRef, holdRingRef, holdCircleRef, orderRef, onCommit]);
}
