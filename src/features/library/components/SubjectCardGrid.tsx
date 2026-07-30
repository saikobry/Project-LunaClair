import { useRef, useEffect, useState, useMemo, useCallback, useLayoutEffect, type PointerEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import {
  GraduationCap,
  ArrowRight,
  SquarePen,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';
import { DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import type { Subject } from '../../../domain/library';
import { Card } from '../../../shared/ui/Card';
import { ActionMenu, menuItemStyles } from '../../../shared/components/ActionMenu';

// Pixels of pointer movement tolerated during a long-press before treating
// it as an intentional scroll/drag rather than a still hold.
const LONG_PRESS_MOVE_THRESHOLD = 10;
const LONG_PRESS_DURATION_MS = 400;

const dropzonePulse = stylex.keyframes({
  '0%': { opacity: 0.4, transform: 'scale(1)' },
  '100%': { opacity: 0.95, transform: 'scale(1)' },
});

const styles = stylex.create({
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
    transition: 'background-color 0.2s ease',
  },
  subjectsGridReorderActive: {
    backgroundColor: 'var(--color-background-muted)',
    padding: 16,
    borderRadius: 16,
  },
  subjectCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  subjectCardDragging: {
    opacity: 0.35,
    transform: 'scale(0.97)',
  },
  subjectCardDragOver: {
    position: 'relative',
    zIndex: 5,
  },
  dropTargetGlow: {
    position: 'absolute',
    inset: -5,
    borderRadius: 20,
    pointerEvents: 'none',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent-muted)',
    animationName: dropzonePulse,
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    zIndex: 10,
  },
  reorderModeCard: {
    cursor: 'grab',
    borderRadius: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  movedCardBorder: {
    boxShadow: '0 0 0 2px var(--color-accent-muted)',
  },
  subjectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  subjectIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  subjectTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subjectDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  subjectMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    marginTop: 4,
  },
  movedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  unsavedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 12,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  reorderToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border-disabled)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  saveButton: {
    padding: '6px 16px',
    borderRadius: 6,
    backgroundColor: 'var(--color-accent)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    ':hover': {
      opacity: 0.9,
    },
  },
  saveButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    ':hover': {
      opacity: 0.5,
    },
  },
  cancelButton: {
    padding: '6px 16px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
    fontWeight: 600,
    fontSize: 14,
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    ':hover': {
      opacity: 0.8,
    },
  },
  cancelButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    ':hover': {
      opacity: 0.5,
    },
  },
});

// ── Draggable Subject Card (Child) ──────────────────────────────
function DraggableSubjectCard({
  subject,
  materialCount,
  isReorderMode,
  isMoved,
  onEnterReorderMode,
  onDropCard,
  onOpen,
  onEdit,
  onDelete,
}: {
  subject: Subject;
  materialCount: number;
  isReorderMode: boolean;
  isMoved: boolean;
  onEnterReorderMode: () => void;
  onDropCard: (sourceId: string, targetId: string) => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => clearPressTimer, []);

  // ── Long Press Logic with GSAP Animation ──
  const startPress = (e: PointerEvent) => {
    if (e.button !== 0 || isReorderMode) return;

    pressOrigin.current = { x: e.clientX, y: e.clientY };
    longPressFired.current = false;

    const el = cardRef.current;
    if (el) {
      gsap.to(el, {
        scale: 0.96,
        rotate: 1,
        duration: 0.4,
        ease: 'power1.inOut',
        overwrite: 'auto',
      });
    }

    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onEnterReorderMode();
      if (el) {
        gsap.to(el, {
          scale: 1.02,
          rotate: 0,
          duration: 0.2,
          ease: 'back.out(1.7)',
          overwrite: 'auto',
        });
      }
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION_MS);
  };

  const resetCardTransform = () => {
    const el = cardRef.current;
    if (el && !isReorderMode && !isDragging) {
      gsap.to(el, {
        scale: 1,
        rotate: 0,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }
  };

  const endPress = () => {
    clearPressTimer();
    pressOrigin.current = null;
    resetCardTransform();
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (longPressFired.current || !pressOrigin.current) return;

    const dx = e.clientX - pressOrigin.current.x;
    const dy = e.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) < LONG_PRESS_MOVE_THRESHOLD) return;

    clearPressTimer();
    pressOrigin.current = null;
    resetCardTransform();
  };

  // ── Pragmatic DnD Setup ──
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    return combine(
      draggable({
        element: el,
        canDrag: () => isReorderMode,
        getInitialData: () => ({ id: subject.id }),
        onDragStart: () => {
          setIsDragging(true);
          requestAnimationFrame(() => {
            gsap.to(el, {
              scale: 1.03,
              opacity: 0.7,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              duration: 0.2,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          });
        },
        onDrop: () => {
          setIsDragging(false);
          gsap.to(el, {
            scale: 1,
            opacity: 1,
            boxShadow: 'none',
            duration: 0.25,
            ease: 'back.out(1.2)',
            overwrite: 'auto',
          });
        },
      }),
      dropTargetForElements({
        element: el,
        canDrop: () => isReorderMode,
        getData: () => ({ id: subject.id }),
        onDragEnter: ({ source }) => {
          if (source.data.id !== subject.id) {
            setIsDragOver(true);
            gsap.to(el, { scale: 1.02, duration: 0.15, ease: 'power1.out', overwrite: 'auto' });
          }
        },
        onDragLeave: () => {
          setIsDragOver(false);
          gsap.to(el, { scale: 1, duration: 0.15, overwrite: 'auto' });
        },
        onDrop: ({ source }) => {
          setIsDragOver(false);
          gsap.to(el, { scale: 1, duration: 0.1, overwrite: 'auto' });

          if (source.data.id !== subject.id) {
            onDropCard(source.data.id as string, subject.id);
          }
        },
      }),
    );
  }, [subject.id, isReorderMode, onDropCard]);

  return (
    <div
      ref={cardRef}
      data-subject-id={subject.id}
      draggable={isReorderMode}
      {...stylex.props(
        isDragging && styles.subjectCardDragging,
        isDragOver && styles.subjectCardDragOver,
        isReorderMode && styles.reorderModeCard,
        isReorderMode && isMoved && styles.movedCardBorder,
      )}
      data-animate="stagger-card"
      style={{
        position: 'relative',
        userSelect: isDragging ? 'none' : 'auto',
        height: '100%',
        borderRadius: 16,
      }}
    >
      {/* Animated Drop Target Glow Ring — shown only when this card is being hovered as a drop zone */}
      {isReorderMode && isDragOver && (
        <div {...stylex.props(styles.dropTargetGlow)} />
      )}
      <Card>
        <div
          {...stylex.props(styles.subjectCard)}
          onClick={() => { if (!isReorderMode) onOpen(); }}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerMove={handlePointerMove}
          onPointerLeave={endPress}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isReorderMode) onOpen();
          }}
        >
          <div {...stylex.props(styles.subjectHeader)}>
            <div {...stylex.props(styles.subjectIcon)}>
              <GraduationCap size={20} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {!isReorderMode && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionMenu>
                    <DropdownMenuItem
                      icon={<SquarePen size={14} />}
                      label="Edit"
                      onClick={onEdit}
                      xstyle={menuItemStyles.item}
                    />
                    <DropdownMenuItem
                      icon={<Trash2 size={14} />}
                      label="Delete"
                      onClick={onDelete}
                      xstyle={menuItemStyles.item}
                    />
                  </ActionMenu>
                </div>
              )}
            </div>
          </div>

          <div {...stylex.props(styles.subjectTitleRow)}>
            <h3 {...stylex.props(styles.subjectTitle)}>{subject.title}</h3>
            {isReorderMode && isMoved && (
              <span {...stylex.props(styles.movedBadge)}>Moved</span>
            )}
          </div>

          {subject.description && (
            <p {...stylex.props(styles.subjectDescription)}>
              {subject.description}
            </p>
          )}
          <div {...stylex.props(styles.subjectMeta)}>
            <span>{materialCount} materials</span>
            <ArrowRight size={12} />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Parent Grid Component ─────────────────────────────────────────
interface SubjectCardGridProps {
  subjects: Subject[];
  allMaterials: Array<{ subjectId?: string | null }>;
  isSavingReorder?: boolean;
  onOpenSubject: (subjectId: string) => void;
  onSubjectEdit: (subject: Subject) => void;
  onSubjectDelete: (subject: Subject) => void;
  onSubjectReorder: (orderedIds: string[]) => void;
}

export default function SubjectCardGrid({
  subjects,
  allMaterials,
  isSavingReorder = false,
  onOpenSubject,
  onSubjectEdit,
  onSubjectDelete,
  onSubjectReorder,
}: SubjectCardGridProps) {
  const subjectsGridRef = useRef<HTMLDivElement>(null);

  // ── Reorder & Preview State ──
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [previewSubjects, setPreviewSubjects] = useState<Subject[]>(subjects);

  // Keep preview in sync when parent subjects change outside reorder mode
  useEffect(() => {
    if (!isReorderMode) {
      setPreviewSubjects(subjects);
    }
  }, [subjects, isReorderMode]);

  // ── GSAP FLIP position transition for smooth 60fps displacement ──
  const cardPositions = useRef<Map<string, DOMRect>>(new Map());
  const prevOrderRef = useRef<string[]>([]);

  useLayoutEffect(() => {
    if (!subjectsGridRef.current) return;
    const currentOrder = previewSubjects.map((s) => s.id);
    const orderChanged =
      prevOrderRef.current.length === currentOrder.length &&
      prevOrderRef.current.some((id, i) => id !== currentOrder[i]);

    prevOrderRef.current = currentOrder;

    const cards = subjectsGridRef.current.querySelectorAll<HTMLElement>('[data-subject-id]');

    if (!orderChanged) {
      // Order didn't change — update stored rects without triggering FLIP transforms
      cards.forEach((card) => {
        const id = card.getAttribute('data-subject-id');
        if (id) cardPositions.current.set(id, card.getBoundingClientRect());
      });
      return;
    }

    // Order changed — animate cards gliding from previous rect to new rect
    cards.forEach((card) => {
      const id = card.getAttribute('data-subject-id');
      if (!id) return;
      const newRect = card.getBoundingClientRect();
      const prevRect = cardPositions.current.get(id);

      if (prevRect) {
        const dx = prevRect.left - newRect.left;
        const dy = prevRect.top - newRect.top;
        // Ignore minor sub-pixel or scale-induced bounding box shifts (< 5px)
        if (Math.hypot(dx, dy) > 5) {
          gsap.fromTo(
            card,
            { x: dx, y: dy },
            { x: 0, y: 0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' },
          );
        }
      }
      cardPositions.current.set(id, newRect);
    });
  }, [previewSubjects]);

  // ── Precomputed material counts ──
  const materialCountBySubjectId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const material of allMaterials) {
      if (!material.subjectId) continue;
      counts.set(material.subjectId, (counts.get(material.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [allMaterials]);

  // ── Corrected swap handler — places moved item at target position ──
  const handleDropReorder = useCallback((sourceId: string, targetId: string) => {
    setPreviewSubjects((prev) => {
      const sourceIdx = prev.findIndex((s) => s.id === sourceId);
      const targetIdx = prev.findIndex((s) => s.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(sourceIdx, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
  }, []);

  // ── Derived state ──
  const hasUnsavedChanges = useMemo(() => {
    if (previewSubjects.length !== subjects.length) return true;
    return previewSubjects.some((sub, i) => sub.id !== subjects[i]?.id);
  }, [previewSubjects, subjects]);

  const getIsMoved = useCallback(
    (subjectId: string, index: number): boolean => subjects[index]?.id !== subjectId,
    [subjects],
  );

  // ── Event handlers ──
  const handleEnterReorder = useCallback(() => {
    setPreviewSubjects((prev) => (prev.length ? prev : [...subjects]));
    setIsReorderMode(true);
  }, [subjects]);

  const handleCancelReorder = () => {
    if (isSavingReorder) return;
    setPreviewSubjects([...subjects]);
    setIsReorderMode(false);
  };

  const handleSaveReorder = () => {
    if (isSavingReorder) return;
    onSubjectReorder(previewSubjects.map((s) => s.id));
    setIsReorderMode(false);
  };

  // Parent controls the initial staggered entrance animation
  useGSAP(() => {
    if (!subjectsGridRef.current) return;
    const cards = subjectsGridRef.current.querySelectorAll('[data-animate="stagger-card"]');
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { scope: subjectsGridRef, dependencies: [subjects] });

  return (
    <div {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <h2 {...stylex.props(styles.sectionTitle)}>Subjects</h2>

        <div {...stylex.props(styles.actionRow)}>
          {isReorderMode && hasUnsavedChanges && (
            <span {...stylex.props(styles.unsavedPill)}>Unsaved changes</span>
          )}

          {isReorderMode ? (
            <>
              <button
                {...stylex.props(
                  styles.cancelButton,
                  isSavingReorder && styles.cancelButtonDisabled,
                )}
                onClick={handleCancelReorder}
                disabled={isSavingReorder}
              >
                Cancel
              </button>
              <button
                {...stylex.props(
                  styles.saveButton,
                  isSavingReorder && styles.saveButtonDisabled,
                )}
                onClick={handleSaveReorder}
                disabled={isSavingReorder}
              >
                {isSavingReorder ? 'Saving...' : 'Save Order'}
              </button>
            </>
          ) : (
            <button
              {...stylex.props(styles.reorderToggleBtn)}
              onClick={handleEnterReorder}
            >
              <ArrowUpDown size={14} />
              Reorder
            </button>
          )}
        </div>
      </div>

      <div
        ref={subjectsGridRef}
        {...stylex.props(
          styles.subjectsGrid,
          isReorderMode && styles.subjectsGridReorderActive,
        )}
      >
        {previewSubjects.map((subject, index) => (
          <DraggableSubjectCard
            key={subject.id}
            subject={subject}
            materialCount={materialCountBySubjectId.get(subject.id) ?? 0}
            isReorderMode={isReorderMode}
            isMoved={getIsMoved(subject.id, index)}
            onEnterReorderMode={handleEnterReorder}
            onDropCard={handleDropReorder}
            onOpen={() => onOpenSubject(subject.id)}
            onEdit={() => onSubjectEdit(subject)}
            onDelete={() => onSubjectDelete(subject)}
          />
        ))}
      </div>
    </div>
  );
}

