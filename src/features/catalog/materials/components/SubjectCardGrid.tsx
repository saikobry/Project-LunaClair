import { useRef, useEffect, useState, useMemo, useCallback, useLayoutEffect, type PointerEvent } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import {
  GraduationCap,
  ArrowRight,
  SquarePen,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';
import type { Subject } from '../../../../domain/library';
import { Card } from '../../../../shared/ui/Card';
import { ActionMenu, ActionMenuItem } from '../../../../shared/components/ActionMenu';

gsap.registerPlugin(Draggable);

// Pixels of pointer movement tolerated during a long-press before treating
// it as an intentional scroll/drag rather than a still hold.
const LONG_PRESS_MOVE_THRESHOLD = 10;
const LONG_PRESS_DURATION_MS = 400;

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
  onOpen,
  onEdit,
  onDelete,
  suppressClickRef,
  suppressedCardIdRef,
}: {
  subject: Subject;
  materialCount: number;
  isReorderMode: boolean;
  isMoved: boolean;
  onEnterReorderMode: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  suppressClickRef: React.RefObject<boolean>;
  suppressedCardIdRef: React.RefObject<string | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

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
    if (el && !isReorderMode) {
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

  return (
    <div
      ref={cardRef}
      data-subject-id={subject.id}
      {...stylex.props(
        isReorderMode && styles.reorderModeCard,
        isReorderMode && isMoved && styles.movedCardBorder,
      )}
      data-animate="stagger-card"
      style={{
        position: 'relative',
        height: '100%',
        borderRadius: 16,
      }}
    >
      <Card>
        <div
          {...stylex.props(styles.subjectCard)}
          onClick={() => {
            if (!isReorderMode && !(suppressClickRef.current && suppressedCardIdRef.current === subject.id)) {
              onOpen();
            }
          }}
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
                    <ActionMenuItem
                      icon={<SquarePen size={14} />}
                      label="Edit"
                      description="Modify this subject"
                      onClick={onEdit}
                    />
                    <ActionMenuItem
                      icon={<Trash2 size={14} />}
                      label="Delete"
                      description="This action cannot be undone"
                      onClick={onDelete}
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
// ── Subcomponents & Hooks ─────────────────────────────────────────

interface SubjectGridHeaderProps {
  isReorderMode: boolean;
  hasUnsavedChanges: boolean;
  isSavingReorder: boolean;
  onEnterReorder: () => void;
  onCancelReorder: () => void;
  onSaveReorder: () => void;
}

function SubjectGridHeader({
  isReorderMode,
  hasUnsavedChanges,
  isSavingReorder,
  onEnterReorder,
  onCancelReorder,
  onSaveReorder,
}: SubjectGridHeaderProps) {
  return (
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
              onClick={onCancelReorder}
              disabled={isSavingReorder}
            >
              Cancel
            </button>
            <button
              {...stylex.props(
                styles.saveButton,
                isSavingReorder && styles.saveButtonDisabled,
              )}
              onClick={onSaveReorder}
              disabled={isSavingReorder}
            >
              {isSavingReorder ? 'Saving...' : 'Save Order'}
            </button>
          </>
        ) : (
          <button
            {...stylex.props(styles.reorderToggleBtn)}
            onClick={onEnterReorder}
          >
            <ArrowUpDown size={14} />
            Reorder
          </button>
        )}
      </div>
    </div>
  );
}

interface UseSubjectGridReorderOptions {
  subjects: Subject[];
  isSavingReorder: boolean;
  onSubjectReorder: (orderedIds: string[]) => void;
  subjectsGridRef: React.RefObject<HTMLDivElement | null>;
}

function useSubjectGridReorder({
  subjects,
  isSavingReorder,
  onSubjectReorder,
  subjectsGridRef,
}: UseSubjectGridReorderOptions) {
  // ── Reorder & Preview State ──
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [prevSubjects, setPrevSubjects] = useState(subjects);
  const [previewSubjects, setPreviewSubjects] = useState<Subject[]>(subjects);

  if (subjects !== prevSubjects) {
    setPrevSubjects(subjects);
    if (!isReorderMode) {
      setPreviewSubjects(subjects);
    }
  }

  // ── GSAP Draggable Reorder Registry & Math Engine ──
  const draggablesRef = useRef<Map<string, Draggable>>(new Map());
  const wasDraggedRef = useRef(false);
  const dragOriginIndexRef = useRef(-1);
  const candidateIndexRef = useRef(-1);

  const suppressClickRef = useRef(false);
  const suppressedCardIdRef = useRef<string | null>(null);
  const suppressTimerRef = useRef<number | null>(null);

  const previewSubjectsRef = useRef(previewSubjects);
  useLayoutEffect(() => {
    previewSubjectsRef.current = previewSubjects;
  });

  const colCountRef = useRef(1);
  const cardDimsRef = useRef<{ width: number; height: number; gap: number }>({ width: 280, height: 160, gap: 16 });

  const updateGridMetrics = useCallback(() => {
    const gridEl = subjectsGridRef.current;
    if (!gridEl) return;
    const cards = gridEl.querySelectorAll<HTMLElement>('[data-subject-id]');
    if (!cards.length) return;

    const firstCard = cards[0];
    const cardWidth = firstCard.offsetWidth;
    const cardHeight = firstCard.offsetHeight;
    const gap = 16;

    const templateColumns = getComputedStyle(gridEl).gridTemplateColumns;
    const colCount =
      templateColumns && templateColumns !== 'none'
        ? Math.max(1, templateColumns.split(' ').length)
        : Math.max(1, Math.floor((gridEl.clientWidth + gap) / (cardWidth + gap)));

    colCountRef.current = colCount;
    cardDimsRef.current = { width: cardWidth, height: cardHeight, gap };
  }, [subjectsGridRef]);

  useLayoutEffect(() => {
    updateGridMetrics();
    const gridEl = subjectsGridRef.current;
    if (!gridEl) return;

    const observer = new ResizeObserver(() => {
      updateGridMetrics();
    });
    observer.observe(gridEl);

    return () => observer.disconnect();
  }, [updateGridMetrics, previewSubjects, subjectsGridRef]);

  useLayoutEffect(() => {
    const gridEl = subjectsGridRef.current;
    if (!gridEl || !isReorderMode) {
      for (const instance of draggablesRef.current.values()) {
        instance.kill();
      }
      draggablesRef.current.clear();
      return;
    }

    const currentIds = new Set(previewSubjects.map((s) => s.id));
    for (const [id, instance] of Array.from(draggablesRef.current.entries())) {
      if (!currentIds.has(id)) {
        instance.kill();
        draggablesRef.current.delete(id);
      }
    }

    for (const subject of previewSubjects) {
      const cardEl = gridEl.querySelector<HTMLElement>(`[data-subject-id="${subject.id}"]`);
      if (!cardEl) continue;

      const existing = Draggable.get(cardEl);
      if (existing) {
        draggablesRef.current.set(subject.id, existing as Draggable);
        continue;
      }

      const [instance] = Draggable.create(cardEl, {
        type: 'x,y',
        zIndexBoost: false,
        cursor: 'grab',
        activeCursor: 'grabbing',
        onPress(this: Draggable) {
          wasDraggedRef.current = false;
          const indexMap = new Map(previewSubjectsRef.current.map((s, idx) => [s.id, idx]));
          const fromIdx = indexMap.get(subject.id) ?? -1;
          dragOriginIndexRef.current = fromIdx;
          candidateIndexRef.current = fromIdx;

          gsap.set(cardEl, { zIndex: 1000 });
          gsap.to(cardEl, {
            scale: 1.03,
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            duration: 0.2,
            overwrite: 'auto',
          });
        },
        onDragStart(this: Draggable) {
          updateGridMetrics();
        },
        onDrag(this: Draggable) {
          wasDraggedRef.current = true;
          const currentList = previewSubjectsRef.current;
          const fromIdx = dragOriginIndexRef.current;
          if (fromIdx === -1) return;

          const gridRect = gridEl.getBoundingClientRect();
          const cardRect = cardEl.getBoundingClientRect();
          const centerX = cardRect.left - gridRect.left + cardRect.width / 2;
          const centerY = cardRect.top - gridRect.top + cardRect.height / 2;

          const { width: cardW, height: cardH, gap } = cardDimsRef.current;
          const cols = colCountRef.current;

          const targetCol = Math.max(0, Math.min(cols - 1, Math.floor(centerX / (cardW + gap))));
          const targetRow = Math.max(0, Math.floor(centerY / (cardH + gap)));
          const rawTargetIndex = targetRow * cols + targetCol;
          const candidateIdx = Math.max(0, Math.min(currentList.length - 1, rawTargetIndex));

          const prevCandidate = candidateIndexRef.current;
          if (candidateIdx !== prevCandidate) {
            const candCol = prevCandidate % cols;
            const candRow = Math.floor(prevCandidate / cols);
            const candCenterX = candCol * (cardW + gap) + cardW / 2;
            const candCenterY = candRow * (cardH + gap) + cardH / 2;

            const dist = Math.hypot(centerX - candCenterX, centerY - candCenterY);
            const SWAP_EPSILON = 20;
            if (dist < SWAP_EPSILON) return;

            candidateIndexRef.current = candidateIdx;
          }

          const toIdx = candidateIndexRef.current;

          currentList.forEach((item, i) => {
            if (item.id === subject.id) return;
            const itemEl = gridEl.querySelector<HTMLElement>(`[data-subject-id="${item.id}"]`);
            if (!itemEl) return;

            let newSlot = i;
            if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
              newSlot = i - 1;
            } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
              newSlot = i + 1;
            }

            const originCol = i % cols;
            const originRow = Math.floor(i / cols);
            const slotCol = newSlot % cols;
            const slotRow = Math.floor(newSlot / cols);

            const dx = (slotCol - originCol) * (cardW + gap);
            const dy = (slotRow - originRow) * (cardH + gap);

            gsap.to(itemEl, {
              x: dx,
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
          const { width: cardW, height: cardH, gap } = cardDimsRef.current;
          const cols = colCountRef.current;

          if (wasDraggedRef.current) {
            suppressClickRef.current = true;
            suppressedCardIdRef.current = subject.id;
            if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
            suppressTimerRef.current = window.setTimeout(() => {
              suppressClickRef.current = false;
              suppressedCardIdRef.current = null;
              suppressTimerRef.current = null;
            }, 150);
          }

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const originCol = fromIdx % cols;
            const originRow = Math.floor(fromIdx / cols);
            const slotCol = toIdx % cols;
            const slotRow = Math.floor(toIdx / cols);

            const finalDx = (slotCol - originCol) * (cardW + gap);
            const finalDy = (slotRow - originRow) * (cardH + gap);

            gsap.to(cardEl, {
              x: finalDx,
              y: finalDy,
              scale: 1,
              boxShadow: 'none',
              duration: 0.25,
              ease: 'power2.out',
              overwrite: 'auto',
              onComplete: () => {
                setPreviewSubjects((prev) => {
                  const updated = [...prev];
                  const [moved] = updated.splice(fromIdx, 1);
                  updated.splice(toIdx, 0, moved);
                  return updated;
                });

                const allCards = gridEl.querySelectorAll<HTMLElement>('[data-subject-id]');
                gsap.killTweensOf(allCards, 'x,y');
                requestAnimationFrame(() => {
                  allCards.forEach((card) => {
                    gsap.set(card, { clearProps: 'zIndex,x,y' });
                  });
                });
              },
            });
          } else {
            gsap.to(cardEl, {
              x: 0,
              y: 0,
              scale: 1,
              boxShadow: 'none',
              duration: 0.2,
              ease: 'power2.out',
              overwrite: 'auto',
              onComplete: () => {
                gsap.set(cardEl, { clearProps: 'zIndex,x,y' });
              },
            });
          }
        },
      });

      draggablesRef.current.set(subject.id, instance);
    }
  }, [previewSubjects, isReorderMode, setPreviewSubjects, updateGridMetrics, subjectsGridRef]);

  useEffect(() => {
    const draggables = draggablesRef.current;
    return () => {
      for (const instance of draggables.values()) {
        instance.kill();
      }
      draggables.clear();
      if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (previewSubjects.length !== subjects.length) return true;
    return previewSubjects.some((sub, i) => sub.id !== subjects[i]?.id);
  }, [previewSubjects, subjects]);

  const getIsMoved = useCallback(
    (subjectId: string, index: number): boolean => subjects[index]?.id !== subjectId,
    [subjects],
  );

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

  return {
    isReorderMode,
    previewSubjects,
    hasUnsavedChanges,
    handleEnterReorder,
    handleCancelReorder,
    handleSaveReorder,
    suppressClickRef,
    suppressedCardIdRef,
    getIsMoved,
  };
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

  const {
    isReorderMode,
    previewSubjects,
    hasUnsavedChanges,
    handleEnterReorder,
    handleCancelReorder,
    handleSaveReorder,
    suppressClickRef,
    suppressedCardIdRef,
    getIsMoved,
  } = useSubjectGridReorder({
    subjects,
    isSavingReorder,
    onSubjectReorder,
    subjectsGridRef,
  });

  // ── Precomputed material counts ──
  const materialCountBySubjectId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const material of allMaterials) {
      if (!material.subjectId) continue;
      counts.set(material.subjectId, (counts.get(material.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [allMaterials]);

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
      <SubjectGridHeader
        isReorderMode={isReorderMode}
        hasUnsavedChanges={hasUnsavedChanges}
        isSavingReorder={isSavingReorder}
        onEnterReorder={handleEnterReorder}
        onCancelReorder={handleCancelReorder}
        onSaveReorder={handleSaveReorder}
      />

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
            onOpen={() => onOpenSubject(subject.id)}
            onEdit={() => onSubjectEdit(subject)}
            onDelete={() => onSubjectDelete(subject)}
            suppressClickRef={suppressClickRef}
            suppressedCardIdRef={suppressedCardIdRef}
          />
        ))}
      </div>
    </div>
  );
}


