import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import { Button } from '../../../shared/ui/Button/Button';
import type { QuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasMetaCard } from './QuizCanvasMetaCard';
import { QuizCanvasQuestionCard } from './QuizCanvasQuestionCard';
import { QuizCanvasToolbarLane } from './QuizCanvasToolbarLane';

gsap.registerPlugin(Draggable);

const GUTTER = 20;
/** Shared duration for accordion reflow and the physical push height tweens. */
const REFLOW_DURATION = 0.35;
/**
 * Baseline collapsed card height (px) — the held card auto-collapses to this
 * during a drag. Sized to fit an unclipped collapsed card: 16px padding ×2 +
 * ~40px header content + 2px accent border (see `cardDragging`), so the
 * compact summary's padding and border are never chopped.
 */
const COMPACT_HEIGHT = 76;
/**
 * Reserved bottom dropzone (px) below the last question card. It gives dragged
 * cards footroom past the bottom card's midpoint so any card — collapsed or
 * expanded — can swap into the last slot. Geometry: a fully expanded card
 * (≈380px) needs its center to reach `gridHeight − lastCardH/2 + epsilon`,
 * which requires a buffer of ≥ ~158px; 200 keeps margin for taller editors.
 */
const BOTTOM_BUFFER = 200;
/** Hysteresis (px) applied to midpoint swap thresholds to prevent oscillation. */
const SWAP_EPSILON = 4;

const styles = stylex.create({
    canvas: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 16px 96px',
        '@media (min-width: 640px)': {
            padding: '24px 16px 96px',
        },
    },
    canvasBody: {
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        width: '100%',
        maxWidth: 832,
        gap: 16,
        justifyContent: 'center',
        '@media (max-width: 639px)': {
            gap: 0,
        },
    },
    questionColumn: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        maxWidth: 760,
    },
    metaWrapper: {
        width: '100%',
        margin: '0 0 20px',
    },
    grid: {
        position: 'relative',
        width: '100%',
    },
    bottomBuffer: {
        height: BOTTOM_BUFFER,
        width: '100%',
        flexShrink: 0,
        pointerEvents: 'none',
    },
    cardWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
    },
    cardWrapperActive: {
        zIndex: 2,
    },
    emptyCanvas: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '40px 24px',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    emptyHint: {
        fontSize: 13,
        margin: 0,
    },
});

interface QuizCanvasQuestionListProps {
    draft: QuizDraft;
    activeCardId: string | null;
    errors: QuizDraftErrors | null;
    titleCardRef: RefObject<HTMLDivElement | null>;
    /** Live registry of question card elements keyed by tempId (scroll-to on focus). */
    cardRefs: RefObject<Map<string, HTMLElement>>;
    canvas: QuizCanvas;
    /** Scrolls a card into view after structural mutations (add/duplicate). */
    onFocusCard: (tempId: string) => void;
    /** Opens the bank import picker anchored after the given card index. */
    onImportFromBank: (index: number) => void;
}

/**
 * Scrollable canvas body of the quiz builder.
 *
 * Renders the meta card and single-column question cards. Cards are placed
 * into an absolutely-positioned grid using synchronous DOM height accumulation
 * before paint, guaranteeing zero overlap when expanding/collapsing.
 *
 * Physical push accordion physics, GSAP Draggable reordering, and height tweens
 * are managed 100% locally here. The sticky right toolbar dock is decoupled and
 * rendered by `<QuizCanvasToolbarLane />`.
 */
export function QuizCanvasQuestionList({
    draft,
    activeCardId,
    errors,
    titleCardRef,
    cardRefs,
    canvas,
    onFocusCard,
    onImportFromBank,
}: QuizCanvasQuestionListProps) {
    const items = draft.items;
    /** Held card tempId as React state — drives the clean collapsed-summary re-render during a drag. */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    /** Incrementing layout version counter to signal settled layout updates to the toolbar lane. */
    const [layoutVersion, setLayoutVersion] = useState(0);
    const gridRef = useRef<HTMLDivElement | null>(null);
    /** Outer bounds container for canvas body flex row. */
    const canvasBodyRef = useRef<HTMLDivElement | null>(null);
    /** Outer bounds container (meta card + question grid + bottom dropzone) for GSAP Draggable. */
    const questionColumnRef = useRef<HTMLDivElement | null>(null);
    const wrapperEls = useRef(new Map<string, HTMLDivElement>());
    /** Live GSAP Draggable instance per mounted card (keyed by tempId). */
    const draggablesRef = useRef(new Map<string, Draggable>());
    /** tempId of the card currently held by GSAP Draggable. */
    const draggingIdRef = useRef<string | null>(null);
    /** True if real drag displacement occurred during the active press cycle. */
    const wasDraggedRef = useRef(false);
    /** Temporary flag to block the trailing click event right after a drop. */
    const suppressClickRef = useRef(false);
    /** tempId of the card whose trailing click is being suppressed (scoped to the dragged card only). */
    const suppressedCardIdRef = useRef<string | null>(null);
    /** Pending suppression-clear timer id (cleared on new suppression and unmount). */
    const suppressTimerRef = useRef<number | null>(null);
    /** tempIds placed at least once (skip initial jump animation). */
    const positionedRef = useRef(new Set<string>());
    /** Live Map of calculated target Y coordinates per card (tempId -> Y). */
    const targetYMapRef = useRef(new Map<string, number>());
    /** Stable wrapper heights from the last settled layout — the "from" state of the next expand/collapse tween. */
    const prevHeightsRef = useRef(new Map<string, number>());
    /**
     * Self-healing per-card RESTING (collapsed) height cache, sampled in
     * `settleLayout` for inactive, error-free cards. Feeds the toolbar lane's
     * resting-position target. Callout mount/unmount resizes wrappers →
     * ResizeObserver → `settleLayout`, so the cache self-corrects without
     * explicit invalidation.
     */
    const collapsedHeightsRef = useRef(new Map<string, number>());
    /** tempIds whose height tween is currently mid-flight (physical push). */
    const heightAnimRef = useRef(new Set<string>());
    /** Previously active card id — detects expand/collapse transitions. */
    const prevActiveCardIdRef = useRef<string | null>(null);
    /** Grid height placed at least once (first placement is instant, not tweened). */
    const gridPositionedRef = useRef(false);

    // Live snapshots so Draggable closures never read stale state.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const activeCardIdRef = useRef(activeCardId);
    activeCardIdRef.current = activeCardId;
    const errorsRef = useRef(errors);
    errorsRef.current = errors;
    const reorderRef = useRef(canvas.reorderItems);
    reorderRef.current = canvas.reorderItems;

    const registerWrapper = useCallback((tempId: string, el: HTMLDivElement | null) => {
        if (el) wrapperEls.current.set(tempId, el);
        else wrapperEls.current.delete(tempId);
    }, []);

    // ── Position Layout (tween or snap) ──
    const applyPositions = useCallback((animate: boolean) => {
        let currentY = 0;
        const targetYMap = new Map<string, number>();

        for (const item of itemsRef.current) {
            const wrapper = wrapperEls.current.get(item.tempId);
            if (!wrapper) continue;

            const height = draggingIdRef.current === item.tempId
                ? COMPACT_HEIGHT
                : wrapper.offsetHeight;
            targetYMap.set(item.tempId, currentY);

            if (draggingIdRef.current !== item.tempId) {
                if (animate && positionedRef.current.has(item.tempId)) {
                    gsap.to(wrapper, {
                        x: 0,
                        y: currentY,
                        duration: REFLOW_DURATION,
                        ease: 'power2.out',
                        overwrite: 'auto',
                    });
                } else {
                    gsap.killTweensOf(wrapper, 'y');
                    gsap.set(wrapper, { x: 0, y: currentY });
                    positionedRef.current.add(item.tempId);
                }
            }

            currentY += height + GUTTER;
        }

        targetYMapRef.current = targetYMap;

        if (gridRef.current) {
            const totalHeight = itemsRef.current.length > 0 ? currentY - GUTTER : 0;
            if (animate && gridPositionedRef.current) {
                gsap.to(gridRef.current, {
                    height: totalHeight,
                    duration: REFLOW_DURATION,
                    ease: 'power2.out',
                    overwrite: 'auto',
                });
            } else {
                gsap.set(gridRef.current, { height: totalHeight });
                gridPositionedRef.current = true;
            }
        }
    }, []);

    const settleLayout = useCallback(() => {
        applyPositions(true);

        for (const item of itemsRef.current) {
            const wrapper = wrapperEls.current.get(item.tempId);
            if (wrapper) prevHeightsRef.current.set(item.tempId, wrapper.offsetHeight);
        }

        // Resting-height cache for the toolbar lane: sample INACTIVE, error-free
        // cards only — at settle they ARE at their resting height. Error cards
        // are skipped so the cache stays callout-free (the lane derives the
        // callout bump from the live `errors` prop instead, avoiding stale
        // snapshots and double-counting). Self-healing: any error state toggle
        // resizes wrappers → ResizeObserver → this settle path.
        for (const item of itemsRef.current) {
            if (activeCardIdRef.current === item.tempId) continue;
            if (errorsRef.current?.items[item.tempId]?.length) continue;
            const wrapper = wrapperEls.current.get(item.tempId);
            if (wrapper) collapsedHeightsRef.current.set(item.tempId, wrapper.offsetHeight);
        }
        setLayoutVersion((v) => v + 1);
    }, [applyPositions]);

    const startHeightTween = useCallback((tempId: string, wrapper: HTMLDivElement, fromHeight: number, toHeight: number) => {
        heightAnimRef.current.add(tempId);

        gsap.set(wrapper, { overflow: 'hidden' });
        gsap.fromTo(
            wrapper,
            { height: fromHeight },
            {
                height: toHeight,
                duration: REFLOW_DURATION,
                ease: 'power2.out',
                overwrite: 'auto',
                onUpdate: () => {
                    applyPositions(false);
                },
                onComplete: () => {
                    heightAnimRef.current.delete(tempId);
                    gsap.set(wrapper, { clearProps: 'height,overflow' });
                    if (heightAnimRef.current.size === 0) settleLayout();
                },
            },
        );
    }, [applyPositions, settleLayout]);

    const updateLayoutPositions = useCallback((options: { animateHeightChange?: boolean } = {}) => {
        if (heightAnimRef.current.size > 0) return;

        if (options.animateHeightChange) {
            let started = false;

            for (const item of itemsRef.current) {
                const wrapper = wrapperEls.current.get(item.tempId);
                if (!wrapper) continue;

                const prevHeight = prevHeightsRef.current.get(item.tempId);
                const currentHeight = wrapper.offsetHeight;
                if (prevHeight !== undefined && prevHeight !== currentHeight) {
                    startHeightTween(item.tempId, wrapper, prevHeight, currentHeight);
                    started = true;
                }
            }

            if (started) {
                applyPositions(false);
                return;
            }
        }

        settleLayout();
    }, [settleLayout, startHeightTween, applyPositions]);

    useLayoutEffect(() => {
        const activeChanged = prevActiveCardIdRef.current !== activeCardId;
        prevActiveCardIdRef.current = activeCardId;
        updateLayoutPositions({ animateHeightChange: activeChanged });
    }, [activeCardId, items, updateLayoutPositions]);

    const prevDraggingIdRef = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (draggingId !== null) {
            const held = wrapperEls.current.get(draggingId);
            if (held) gsap.set(held, { overflow: 'visible' });
        }
        const dragEnded = prevDraggingIdRef.current !== null && draggingId === null;
        prevDraggingIdRef.current = draggingId;
        if (dragEnded) {
            updateLayoutPositions({ animateHeightChange: true });
        }
    }, [draggingId, updateLayoutPositions]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            updateLayoutPositions();
        });

        for (const el of wrapperEls.current.values()) {
            observer.observe(el);
        }

        return () => observer.disconnect();
    }, [items, updateLayoutPositions]);

    useLayoutEffect(() => {
        const currentIds = new Set(items.map((item) => item.tempId));

        for (const [tempId, instance] of Array.from(draggablesRef.current.entries())) {
            if (!currentIds.has(tempId)) {
                instance.kill();
                draggablesRef.current.delete(tempId);
                positionedRef.current.delete(tempId);
                collapsedHeightsRef.current.delete(tempId);
            }
        }

        for (const item of items) {
            const wrapper = wrapperEls.current.get(item.tempId);
            if (!wrapper) continue;
            const existing = Draggable.get(wrapper);
            if (existing) {
                draggablesRef.current.set(item.tempId, existing as Draggable);
                continue;
            }
            const handle = wrapper.querySelector<HTMLElement>('[data-canvas-drag-handle]');
            if (!handle) continue;

            const [instance] = Draggable.create(wrapper, {
                trigger: handle,
                type: 'y',
                zIndexBoost: false,
                cursor: 'grab',
                activeCursor: 'grabbing',
                bounds: questionColumnRef.current || undefined,
                onPress(this: Draggable) {
                    wasDraggedRef.current = false;
                    draggingIdRef.current = item.tempId;
                    gsap.set(wrapper, { zIndex: 1000 });
                    const card = cardRefs.current.get(item.tempId);
                    if (card) {
                        gsap.to(card, {
                            scale: 1.01,
                            duration: 0.2,
                            overwrite: 'auto',
                        });
                    }
                },
                onDragStart(this: Draggable) {
                    gsap.killTweensOf(wrapper, 'height');
                    heightAnimRef.current.delete(item.tempId);
                    setDraggingId(item.tempId);
                    gsap.set(wrapper, { height: COMPACT_HEIGHT, overflow: 'hidden' });
                    applyPositions(true);
                },
                onDrag(this: Draggable) {
                    wasDraggedRef.current = true;
                    const wrapper = wrapperEls.current.get(item.tempId);
                    if (!wrapper) return;

                    const current = itemsRef.current;
                    const from = current.findIndex((entry) => entry.tempId === item.tempId);
                    if (from === -1) return;

                    const dragCenterY = this.y + COMPACT_HEIGHT / 2;

                    for (const [targetId, targetEl] of wrapperEls.current) {
                        if (targetId === item.tempId) continue;
                        const to = current.findIndex((entry) => entry.tempId === targetId);
                        if (to === -1) continue;

                        const targetY = targetYMapRef.current.get(targetId) ?? 0;
                        const targetCenterY = targetY + targetEl.offsetHeight / 2;

                        const shouldSwap = from < to
                            ? dragCenterY >= targetCenterY + SWAP_EPSILON
                            : dragCenterY <= targetCenterY - SWAP_EPSILON;

                        if (shouldSwap) {
                            reorderRef.current(from, to);
                            break;
                        }
                    }
                },
                onRelease(this: Draggable) {
                    if (wasDraggedRef.current) {
                        suppressClickRef.current = true;
                        suppressedCardIdRef.current = item.tempId;
                        if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
                        suppressTimerRef.current = window.setTimeout(() => {
                            suppressClickRef.current = false;
                            suppressedCardIdRef.current = null;
                            suppressTimerRef.current = null;
                        }, 150);
                    }

                    gsap.set(wrapper, { clearProps: 'zIndex' });
                    const card = cardRefs.current.get(item.tempId);
                    if (card) {
                        gsap.to(card, {
                            scale: 1,
                            duration: 0.25,
                            overwrite: 'auto',
                        });
                    }

                    const targetY = targetYMapRef.current.get(item.tempId) ?? 0;
                    gsap.to(wrapper, {
                        x: 0,
                        y: targetY,
                        duration: 0.3,
                        ease: 'power2.out',
                        overwrite: 'auto',
                        onComplete: () => {
                            gsap.set(wrapper, { clearProps: 'height,overflow' });
                            if (draggingIdRef.current === item.tempId) {
                                draggingIdRef.current = null;
                                setDraggingId(null);
                            }
                        },
                    });
                },
            });
            draggablesRef.current.set(item.tempId, instance);
        }
    }, [items, cardRefs, applyPositions, updateLayoutPositions]);

    useEffect(() => () => {
        for (const instance of draggablesRef.current.values()) instance.kill();
        draggablesRef.current.clear();
        if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    }, []);

    return (
        <div {...stylex.props(styles.canvas)}>
            <div ref={canvasBodyRef} {...stylex.props(styles.canvasBody)}>
                <div ref={questionColumnRef} {...stylex.props(styles.questionColumn)}>
                    <div {...stylex.props(styles.metaWrapper)}>
                        <QuizCanvasMetaCard
                            ref={titleCardRef}
                            title={draft.title}
                            description={draft.description ?? ''}
                            passingPercentage={draft.passingPercentage}
                            titleError={errors?.title}
                            onChange={(patch) => canvas.patchDraft(patch)}
                        />
                    </div>

                    {items.length === 0 ? (
                        <div {...stylex.props(styles.emptyCanvas)}>
                            <p {...stylex.props(styles.emptyTitle)}>No questions yet</p>
                            <p {...stylex.props(styles.emptyHint)}>
                                Add your first question to start building this quiz.
                            </p>
                            <Button
                                label="Add first question"
                                variant="primary"
                                onClick={() => onFocusCard(canvas.addItemAt())}
                            >
                                + Add First Question
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div
                                ref={gridRef}
                                {...stylex.props(styles.grid)}
                            >
                                {items.map((item, index) => {
                                    const isActive = activeCardId === item.tempId;
                                    const isDragging = draggingId === item.tempId;
                                    return (
                                        <div
                                            key={item.tempId}
                                            ref={(el) => registerWrapper(item.tempId, el)}
                                            {...stylex.props(styles.cardWrapper, isActive && styles.cardWrapperActive)}
                                        >
                                            <QuizCanvasQuestionCard
                                                item={item}
                                                index={index}
                                                isActive={isActive}
                                                isDragging={isDragging}
                                                errors={errors?.items[item.tempId] ?? []}
                                                cardRef={(el) => {
                                                    if (el) cardRefs.current.set(item.tempId, el);
                                                    else cardRefs.current.delete(item.tempId);
                                                }}
                                                onActivate={() => {
                                                    if (suppressClickRef.current && suppressedCardIdRef.current === item.tempId) return;
                                                    canvas.setActiveCardId(item.tempId);
                                                }}
                                                onChange={(patch) => canvas.updateItem(item.tempId, patch)}
                                                onTypeChange={(type) => canvas.changeItemType(item.tempId, type)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div {...stylex.props(styles.bottomBuffer)} />
                        </>
                    )}
                </div>

                <QuizCanvasToolbarLane
                    items={items}
                    activeCardId={activeCardId}
                    draggingId={draggingId}
                    titleCardRef={titleCardRef}
                    gridRef={gridRef}
                    targetYMap={targetYMapRef.current}
                    layoutVersion={layoutVersion}
                    canvasBodyRef={canvasBodyRef}
                    cardWrapperMapRef={wrapperEls}
                    collapsedHeights={collapsedHeightsRef.current}
                    errors={errors}
                    gutter={GUTTER}
                    collapsedHeightFallback={COMPACT_HEIGHT}
                    canvas={canvas}
                    onFocusCard={onFocusCard}
                    onImportFromBank={onImportFromBank}
                />
            </div>
        </div>
    );
}
