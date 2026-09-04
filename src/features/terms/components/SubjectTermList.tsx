import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronUp, GripVertical, Unlink } from 'lucide-react';
import type { Term } from '../../../domain/library/models/Term';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';

gsap.registerPlugin(Draggable);

/**
 * Enriched term entry rendered by `SubjectTermList`.
 * `materialCount` = study materials in this subject using the term.
 * `subjectCount` = number of subjects the global term is assigned to (≥ 1).
 */
export interface SubjectTermListItem {
  term: Term;
  materialCount: number;
  subjectCount: number;
}

interface SubjectTermListProps {
  /** Assigned terms, enriched with usage counts, in display order. */
  terms: SubjectTermListItem[];
  /** Fired with the new full ordering of term IDs after a drag-drop or arrow move. */
  onReorder: (orderedTermIds: string[]) => void;
  /** Fired when the user requests to unlink a term (by term ID). */
  onRemove: (termId: string) => void;
}

const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 12,
    backgroundColor: 'var(--color-background-surface)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
  },
  rowDragOver: {
    borderColor: 'var(--color-accent)',
    boxShadow: '0 0 0 2px var(--color-accent-muted)',
    backgroundColor: 'var(--color-accent-muted)',
  },
  rowDragging: {
    opacity: 0.5,
  },
  dragHandle: {
    cursor: 'grab',
    flexShrink: 0,
    ':active': {
      cursor: 'grabbing',
    },
  },
  moveGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flexShrink: 0,
  },
  positionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    height: 24,
    padding: '0 6px',
    borderRadius: 'var(--radius-full, 9999px)',
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  termInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  termTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  materialBadge: {
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent-muted)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full, 9999px)',
    whiteSpace: 'nowrap',
  },
  sharedBadge: {
    fontSize: 11.5,
    color: 'var(--color-text-disabled)',
    whiteSpace: 'nowrap',
  },
  unlinkBtn: {
    flexShrink: 0,
    ':hover': {
      color: 'var(--color-error)',
    },
  },
});

function DraggableTermRow({
  item,
  index,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: SubjectTermListItem;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: (termId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const sharedLabel =
    item.subjectCount <= 1
      ? 'Used only in this subject'
      : `Shared across ${item.subjectCount} subjects`;

  const materialLabel = `${item.materialCount} ${item.materialCount === 1 ? 'Material' : 'Materials'}`;

  return (
    <div
      ref={rowRef}
      data-term-id={item.term.id}
      {...stylex.props(styles.row)}
    >
      <IconButton
        ref={handleRef}
        variant="ghost"
        icon={<GripVertical size={16} />}
        label={`Drag to reorder ${item.term.title}`}
        tooltip="Drag to reorder"
        data-drag-handle="true"
        xstyle={styles.dragHandle}
      />

      {/* Keyboard-accessible reordering */}
      <div {...stylex.props(styles.moveGroup)}>
        <IconButton
          variant="ghost"
          size="sm"
          icon={<ChevronUp size={14} />}
          label={`Move ${item.term.title} up`}
          tooltip="Move up"
          isDisabled={!canMoveUp}
          onClick={onMoveUp}
        />
        <IconButton
          variant="ghost"
          size="sm"
          icon={<ChevronDown size={14} />}
          label={`Move ${item.term.title} down`}
          tooltip="Move down"
          isDisabled={!canMoveDown}
          onClick={onMoveDown}
        />
      </div>

      <div {...stylex.props(styles.positionBadge)}>#{index + 1}</div>

      <div {...stylex.props(styles.termInfo)}>
        <p {...stylex.props(styles.termTitle)}>{item.term.title}</p>
        <div {...stylex.props(styles.badges)}>
          <span {...stylex.props(styles.materialBadge)}>{materialLabel}</span>
          <span {...stylex.props(styles.sharedBadge)}>{sharedLabel}</span>
        </div>
      </div>

      <IconButton
        variant="ghost"
        icon={<Unlink size={15} />}
        label={`Unlink ${item.term.title} from subject`}
        tooltip="Unlink from subject"
        xstyle={styles.unlinkBtn}
        onClick={() => onRemove(item.term.id)}
      />
    </div>
  );
}

/**
 * Presentational list of terms assigned to a subject.
 *
 * Strictly presentational: performs zero data fetching, mutations, or
 * modal state management. The container enriches `terms` with usage
 * counts and wires `onReorder` / `onRemove` callbacks. Reordering is
 * available via drag handle and via keyboard-accessible up/down buttons.
 */
export default function SubjectTermList({ terms, onReorder, onRemove }: SubjectTermListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const draggablesRef = useRef<Map<string, Draggable>>(new Map());
  const dragOriginIndexRef = useRef(-1);
  const candidateIndexRef = useRef(-1);
  const wasDraggedRef = useRef(false);

  const termsRef = useRef(terms);
  useLayoutEffect(() => {
    termsRef.current = terms;
  });

  useLayoutEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const currentIds = new Set(terms.map((t) => t.term.id));
    for (const [id, instance] of Array.from(draggablesRef.current.entries())) {
      if (!currentIds.has(id)) {
        instance.kill();
        draggablesRef.current.delete(id);
      }
    }

    for (const item of terms) {
      const termId = item.term.id;
      const rowEl = listEl.querySelector<HTMLElement>(`[data-term-id="${termId}"]`);
      if (!rowEl) continue;
      const handleEl = rowEl.querySelector<HTMLElement>('[data-drag-handle="true"]');
      if (!handleEl) continue;

      const existing = Draggable.get(rowEl);
      if (existing) {
        draggablesRef.current.set(termId, existing as Draggable);
        continue;
      }

      const [instance] = Draggable.create(rowEl, {
        trigger: handleEl,
        type: 'y',
        lockAxis: true,
        zIndexBoost: false,
        cursor: 'grab',
        activeCursor: 'grabbing',
        onPress(this: Draggable) {
          wasDraggedRef.current = false;
          // Resolve the origin from the live list rather than a closure
          // snapshot: Draggable instances are reused across reorders, so a
          // captured index map goes stale after the first successful move.
          const indexMap = new Map(termsRef.current.map(({ term }, idx) => [term.id, idx]));
          const fromIdx = indexMap.get(termId) ?? -1;
          dragOriginIndexRef.current = fromIdx;
          candidateIndexRef.current = fromIdx;

          gsap.set(rowEl, { zIndex: 100 });
          gsap.to(rowEl, {
            scale: 1.01,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            duration: 0.15,
            overwrite: 'auto',
          });
        },
        onDrag(this: Draggable) {
          wasDraggedRef.current = true;
          const currentList = termsRef.current;
          const fromIdx = dragOriginIndexRef.current;
          if (fromIdx === -1) return;

          const listRect = listEl.getBoundingClientRect();
          const rowRect = rowEl.getBoundingClientRect();
          const dragCenterY = rowRect.top - listRect.top + rowRect.height / 2;

          const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-term-id]'));
          if (!rows.length) return;
          const rowHeight = rows[0].offsetHeight;
          const gap = 8;

          const rawCandidate = Math.floor(dragCenterY / (rowHeight + gap));
          const candidateIdx = Math.max(0, Math.min(currentList.length - 1, rawCandidate));

          const prevCand = candidateIndexRef.current;
          if (candidateIdx !== prevCand) {
            const prevCenterY = prevCand * (rowHeight + gap) + rowHeight / 2;
            const dist = Math.abs(dragCenterY - prevCenterY);
            if (dist < 15) return;
            candidateIndexRef.current = candidateIdx;
          }

          const toIdx = candidateIndexRef.current;

          currentList.forEach((t, i) => {
            const currentTermId = t.term.id;
            if (currentTermId === termId) return;
            const siblingEl = listEl.querySelector<HTMLElement>(`[data-term-id="${currentTermId}"]`);
            if (!siblingEl) return;

            let newSlot = i;
            if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
              newSlot = i - 1;
            } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
              newSlot = i + 1;
            }

            const dy = (newSlot - i) * (rowHeight + gap);
            gsap.to(siblingEl, {
              y: dy,
              duration: 0.3,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          });
        },
        onRelease(this: Draggable) {
          const fromIdx = dragOriginIndexRef.current;
          const toIdx = candidateIndexRef.current;
          const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-term-id]'));
          const rowHeight = rows[0]?.offsetHeight ?? 60;
          const gap = 8;

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const finalDy = (toIdx - fromIdx) * (rowHeight + gap);

            gsap.to(rowEl, {
              y: finalDy,
              scale: 1,
              boxShadow: 'none',
              duration: 0.2,
              ease: 'power2.out',
              overwrite: 'auto',
              onComplete: () => {
                const next = [...termsRef.current];
                const [moved] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, moved);
                onReorder(next.map((t) => t.term.id));

                const allRows = listEl.querySelectorAll<HTMLElement>('[data-term-id]');
                // Kill the sibling displacement tweens (0.3s, restarted every
                // pointermove) before clearing transforms — otherwise one can
                // still be running when clearProps fires and will re-apply its
                // y, leaving the sibling displaced out of its slot. Defer the
                // clearProps one frame so the reorder has committed to the DOM.
                gsap.killTweensOf(allRows, 'y');
                requestAnimationFrame(() => {
                  allRows.forEach((r) => gsap.set(r, { clearProps: 'zIndex,y' }));
                });
              },
            });
          } else {
            gsap.to(rowEl, {
              y: 0,
              scale: 1,
              boxShadow: 'none',
              duration: 0.15,
              ease: 'power2.out',
              overwrite: 'auto',
              onComplete: () => {
                gsap.set(rowEl, { clearProps: 'zIndex,y' });
              },
            });
          }
        },
      });

      draggablesRef.current.set(item.term.id, instance);
    }
  }, [terms, onReorder]);

  useEffect(() => {
    const draggables = draggablesRef.current;
    return () => {
      for (const instance of draggables.values()) {
        instance.kill();
      }
      draggables.clear();
    };
  }, []);

  // Shared move helper: moves the term at fromIndex to toIndex (splice + insert).
  const moveTermTo = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = [...terms];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onReorder(next.map((t) => t.term.id));
    },
    [terms, onReorder],
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      moveTermTo(index, index + direction);
    },
    [moveTermTo],
  );

  return (
    <div ref={listRef} {...stylex.props(styles.list)}>
      {terms.map((item, index) => (
        <DraggableTermRow
          key={item.term.id}
          item={item}
          index={index}
          canMoveUp={index > 0}
          canMoveDown={index < terms.length - 1}
          onMoveUp={() => handleMove(index, -1)}
          onMoveDown={() => handleMove(index, 1)}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
