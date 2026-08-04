import { useCallback, useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronUp, GripVertical, Unlink } from 'lucide-react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import type { Term } from '../../../../domain/library';
import { IconButton } from '../../../../shared/ui/IconButton';

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
      color: '#dc2626',
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
  onDropOn,
  onRemove,
}: {
  item: SubjectTermListItem;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDropOn: (sourceId: string, targetId: string) => void;
  onRemove: (termId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pragmatic DnD: the grip handle is the draggable source, the row is the drop target.
  useEffect(() => {
    const rowEl = rowRef.current;
    const handleEl = handleRef.current;
    if (!rowEl || !handleEl) return;

    return combine(
      draggable({
        element: handleEl,
        getInitialData: () => ({ termId: item.term.id }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: rowEl,
        getData: () => ({ termId: item.term.id }),
        onDragEnter: () => setIsDragOver(true),
        onDragLeave: () => setIsDragOver(false),
        onDrop: ({ source }) => {
          setIsDragOver(false);
          const sourceId = (source.data as { termId?: string }).termId;
          if (sourceId && sourceId !== item.term.id) onDropOn(sourceId, item.term.id);
        },
      }),
    );
  }, [item.term.id, onDropOn]);

  const sharedLabel =
    item.subjectCount <= 1
      ? 'Used only in this subject'
      : `Shared across ${item.subjectCount} subjects`;

  const materialLabel = `${item.materialCount} ${item.materialCount === 1 ? 'Material' : 'Materials'}`;

  return (
    <div
      ref={rowRef}
      {...stylex.props(
        styles.row,
        isDragging && styles.rowDragging,
        isDragOver && styles.rowDragOver,
      )}
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

  const handleDropOn = useCallback(
    (sourceId: string, targetId: string) => {
      const sourceIndex = terms.findIndex((t) => t.term.id === sourceId);
      const targetIndex = terms.findIndex((t) => t.term.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;
      moveTermTo(sourceIndex, targetIndex);
    },
    [terms, moveTermTo],
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      moveTermTo(index, index + direction);
    },
    [moveTermTo],
  );

  return (
    <div {...stylex.props(styles.list)}>
      {terms.map((item, index) => (
        <DraggableTermRow
          key={item.term.id}
          item={item}
          index={index}
          canMoveUp={index > 0}
          canMoveDown={index < terms.length - 1}
          onMoveUp={() => handleMove(index, -1)}
          onMoveDown={() => handleMove(index, 1)}
          onDropOn={handleDropOn}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
