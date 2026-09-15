import gsap from 'gsap';

/**
 * List geometry and commit animation for a drag-reorderable row list.
 *
 * Everything here is DOM-measuring and GSAP-driven but gesture-agnostic: the
 * desktop `Draggable` path and the mobile hold-to-drag path both feed the same
 * slot math, sibling displacement, and landing snap. Keeping it out of the
 * gesture hooks is what makes `candidateForCenter`'s hysteresis testable as
 * pure arithmetic.
 */

/** Vertical gap between rows — must stay in sync with `styles.list` gap. */
export const ROW_GAP = 10;

/** Drag distance before a new sibling slot is committed (anti-jitter). */
export const SLOT_HYSTERESIS_PX = 15;

/**
 * Shadow applied to the row while it is being dragged.
 *
 * Deliberately not a theme token: there is no shadow role for "element lifted
 * out of the list", and GSAP animates this property, so a `var()` target would
 * have to be interpolated (which GSAP cannot do). Kept as one shared constant
 * so the desktop and mobile gesture paths cannot drift apart.
 */
export const DRAG_LIFT_SHADOW = '0 8px 24px rgba(0, 0, 0, 0.4)';

/** Rows published by the list, in DOM order. */
const ROW_SELECTOR = '[data-material-id]';

export interface RowMetrics {
  rows: HTMLElement[];
  /** First-row height stands in for the uniform row height. */
  rowHeight: number;
}

/** Live row metrics from the list container. */
export function measureRows(listEl: HTMLElement): RowMetrics {
  const rows = Array.from(listEl.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  return { rows, rowHeight: rows[0]?.offsetHeight || 56 };
}

/** The row element for a material id — the DOM contract rows publish. */
export function findRow(listEl: HTMLElement, materialId: string): HTMLElement | null {
  return listEl.querySelector<HTMLElement>(`[data-material-id="${materialId}"]`);
}

/** Constant slot pitch: one row plus the list gap. */
export function slotPitch(rowHeight: number): number {
  return rowHeight + ROW_GAP;
}

/**
 * Slot index for a drag-center Y, with hysteresis against the last slot.
 *
 * Without the hysteresis band a row sitting exactly on a boundary flips slots
 * on sub-pixel pointer jitter; `prev` therefore wins until the drag center
 * travels `SLOT_HYSTERESIS_PX` past the previously reported slot's center.
 */
export function candidateForCenter(
  centerY: number,
  rowHeight: number,
  count: number,
  prev: number,
): number {
  const raw = Math.floor(centerY / slotPitch(rowHeight));
  const idx = Math.max(0, Math.min(count - 1, raw));
  if (idx !== prev) {
    const prevCenterY = prev * slotPitch(rowHeight) + rowHeight / 2;
    if (Math.abs(centerY - prevCenterY) < SLOT_HYSTERESIS_PX) return prev;
  }
  return idx;
}

/** Keeps live rows in the order the hook last committed. */
export interface ReorderOrder {
  forEach(callback: (item: { id: string }, index: number) => void): void;
}

/**
 * Pushes every sibling toward the slot freed by a `fromIdx -> toIdx` move, so
 * the list opens a gap under the dragged row in real time.
 */
export function displaceSiblings({
  listEl,
  order,
  draggedId,
  fromIdx,
  toIdx,
  rowHeight,
}: {
  listEl: HTMLElement;
  order: ReorderOrder;
  draggedId: string;
  fromIdx: number;
  toIdx: number;
  rowHeight: number;
}): void {
  order.forEach((item, index) => {
    if (item.id === draggedId) return;
    const siblingEl = findRow(listEl, item.id);
    if (!siblingEl) return;

    let newSlot = index;
    if (fromIdx < toIdx && index > fromIdx && index <= toIdx) {
      newSlot = index - 1;
    } else if (fromIdx > toIdx && index >= toIdx && index < fromIdx) {
      newSlot = index + 1;
    }

    const dy = (newSlot - index) * slotPitch(rowHeight);
    gsap.to(siblingEl, {
      y: dy,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  });
}

/** Clears every GSAP prop a drag may have left on the given rows. */
export function clearDragProps(elements: Element[] | NodeListOf<HTMLElement>): void {
  elements.forEach((row) =>
    gsap.set(row, { clearProps: 'zIndex,y,boxShadow,borderColor,backgroundColor' }),
  );
}

/**
 * Commits a finished drag (or snaps back) and clears every row transform.
 *
 * `onCommit` applies the new order to state and is only called once the landing
 * snap has finished, so React reconciles the DOM into the target order while
 * the row is already visually in place.
 */
export function settleRow({
  listEl,
  rowEl,
  fromIdx,
  toIdx,
  rowHeight,
  onCommit,
}: {
  listEl: HTMLElement;
  rowEl: HTMLElement;
  fromIdx: number;
  toIdx: number;
  rowHeight: number;
  onCommit: (fromIdx: number, toIdx: number) => void;
}): void {
  if (!rowEl.isConnected) return;

  if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
    const finalDy = (toIdx - fromIdx) * slotPitch(rowHeight);

    gsap.to(rowEl, {
      y: finalDy,
      boxShadow: 'none',
      borderColor: 'var(--color-border)',
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => {
        onCommit(fromIdx, toIdx);

        const allRows = listEl.querySelectorAll<HTMLElement>(ROW_SELECTOR);
        gsap.killTweensOf(allRows, 'y');
        requestAnimationFrame(() => clearDragProps(allRows));
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
      onComplete: () => clearDragProps([rowEl]),
    });
  }
}
