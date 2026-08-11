import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { QuestionDraft, QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import { Button } from '../../../shared/ui/Button/Button';
import type { QuizCanvas } from './hooks/useQuizCanvas';
import { QuizCanvasMetaCard } from './QuizCanvasMetaCard';
import { QuizCanvasQuestionCard } from './QuizCanvasQuestionCard';
import { QuizCanvasToolbarLane } from './QuizCanvasToolbarLane';

gsap.registerPlugin(Draggable);

const GUTTER = 20;
/** Shared duration for accordion reflow and the physical push height tweens. */
const REFLOW_DURATION = 0.35;
/**
 * Fallback collapsed card height (px) — the held card's drag-collapse height
 * when the self-healing `collapsedHeightsRef` hasn't sampled it yet, plus the
 * toolbar lane's never-sampled resting-target fallback. Sized for an
 * UNCLIPPED two-row collapsed card: 16px padding ×2 + ~42px header/prompt
 * row (2-line clamp) + 12px card gap + ~21px metadata badge row + 2px accent
 * border (see `cardDragging`). Real cards use their MEASURED collapsed
 * height via `compactHeightFor`; this constant only covers the pre-settle
 * gap.
 */
const COMPACT_HEIGHT = 116;

/**
 * The drag-collapse height for a card — its MEASURED collapsed height from
 * the self-healing cache when known, else the `COMPACT_HEIGHT` fallback. All
 * drag geometry must agree on this one number: the held card's slot height in
 * `applyPositions`, the forced wrapper height on drag start, and the swap
 * midpoint center in `onDrag`.
 */
function compactHeightFor(cache: RefObject<Map<string, number>>, tempId: string): number {
    return cache.current.get(tempId) ?? COMPACT_HEIGHT;
}
/**
 * Reserved bottom dropzone (px) below the last question card. It gives dragged
 * cards footroom past the bottom card's midpoint so any card — collapsed or
 * expanded — can swap into the last slot. Geometry: a fully expanded card
 * (≈380px) needs its center to reach `gridHeight − lastCardH/2 + epsilon`,
 * which requires a buffer of ≥ ~158px; 160 sits at that documented floor — do
 * not go lower without headlessly re-verifying drag-to-last-slot.
 */
const BOTTOM_BUFFER = 160;
/** Hysteresis (px) applied to midpoint swap thresholds to prevent oscillation. */
const SWAP_EPSILON = 4;

const styles = stylex.create({
    canvas: {
        // WINDOW-SCROLL mode: `.canvas` is no longer a scrollport — the
        // DOCUMENT scrolls (see QuizCanvasBuilder). It remains the horizontal
        // centering column for the maxWidth-capped canvas body; the toolbar
        // lane pins against the VIEWPORT box (sticky-header `topInset` +
        // bottom-bar `bottomInset`), not this element.
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Bottom padding tiers — the space below the drag dropzone at the end
        // of the scroll (the dropzone itself is `BOTTOM_BUFFER` = 160px, which
        // is functional footroom, not dead space):
        // - <640px: 48px — the floating pill sits `calc(84px + safe-area)`
        //   above the viewport bottom (top edge ≈134–170px with a ~50px pill
        //   and up to ~34px safe-area); the 160px dropzone below the last
        //   card keeps it clear, so 48px is safe (the old 96px was overkill).
        // - 640–768px: 24px — no pill at this width; tight end-of-scroll.
        // - ≥768px: 48px — standard desktop breathing room.
        padding: '16px 16px 48px',
        '@media (min-width: 640px)': {
            padding: '24px 16px 24px',
        },
        '@media (min-width: 768px)': {
            padding: '24px 16px 48px',
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
    /**
     * Height (px) of app chrome overlapping the canvas's bottom edge (the
     * shell's mobile bottom nav, ≤768px) — forwarded to the toolbar lane for
     * its bottom-pin bound / unpin gate.
     */
    bottomInset?: number;
    /**
     * Height (px) of the sticky builder header — the toolbar lane's TOP pin
     * bound in viewport space (window-scroll mode): the pinned toolbar locks
     * BELOW this, never over it. Measured by the builder via ResizeObserver.
     */
    topInset?: number;
}

// ── Section hooks ──────────────────────────────────────────────────────────
// The canvas body's two motion subsystems (accordion layout orchestration and
// the GSAP Draggable reorder lifecycle) live in focused hooks below so the
// component stays readable. Shared refs/state are created in the component and
// threaded in as parameters; hook call order mirrors the original effect
// order, which preserves layout-effect sequencing (the snapshot-ref sync in
// the component runs before these hooks' layout effects).

/**
 * Accordion layout orchestration — owns `applyPositions` / `settleLayout` /
 * `startHeightTween` / `updateLayoutPositions` plus the layout effects that
 * drive them (active-card change, drag end, wrapper ResizeObserver). Cards are
 * placed into an absolutely-positioned grid using synchronous DOM height
 * accumulation before paint, guaranteeing zero overlap when expanding /
 * collapsing; expanding/collapsing cards are physically pushed with GSAP
 * height tweens. Also owns the resting-height cache (`collapsedHeightsRef`)
 * sampled at settle for the toolbar lane's resting target.
 */
function useCardPositionLayout(params: {
    items: QuestionDraft[];
    activeCardId: string | null;
    draggingId: string | null;
    itemsRef: RefObject<QuestionDraft[]>;
    activeCardIdRef: RefObject<string | null>;
    errorsRef: RefObject<QuizDraftErrors | null>;
    wrapperEls: RefObject<Map<string, HTMLDivElement>>;
    draggingIdRef: RefObject<string | null>;
    positionedRef: RefObject<Set<string>>;
    targetYMapRef: RefObject<Map<string, number>>;
    gridRef: RefObject<HTMLDivElement | null>;
    collapsedHeightsRef: RefObject<Map<string, number>>;
    heightAnimRef: RefObject<Set<string>>;
    prevActiveCardIdRef: RefObject<string | null>;
}): { applyPositions: (animate: boolean) => void } {
    const {
        items,
        activeCardId,
        draggingId,
        itemsRef,
        activeCardIdRef,
        errorsRef,
        wrapperEls,
        draggingIdRef,
        positionedRef,
        targetYMapRef,
        gridRef,
        collapsedHeightsRef,
        heightAnimRef,
        prevActiveCardIdRef,
    } = params;

    /** Grid height placed at least once (first placement is instant, not tweened). */
    const gridPositionedRef = useRef(false);
    /** Stable wrapper heights from the last settled layout — the "from" state of the next expand/collapse tween. */
    const prevHeightsRef = useRef(new Map<string, number>());
    /** Previously held card id — detects drag-end transitions. */
    const prevDraggingIdRef = useRef<string | null>(null);

    // ── Position Layout (tween or snap) ──
    const applyPositions = useCallback((animate: boolean) => {
        let currentY = 0;
        const targetYMap = new Map<string, number>();

        for (const item of itemsRef.current) {
            const wrapper = wrapperEls.current.get(item.tempId);
            if (!wrapper) continue;

            const height = draggingIdRef.current === item.tempId
                ? compactHeightFor(collapsedHeightsRef, item.tempId)
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
        // Deps: all entries are refs threaded through `params` — stable
        // identities, so this callback is still created once; they're listed
        // only so react-doctor/exhaustive-deps sees the captures match.
    }, [itemsRef, wrapperEls, draggingIdRef, positionedRef, targetYMapRef, collapsedHeightsRef, gridRef]);

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
        // Deps: `applyPositions` + stable refs threaded through `params` —
        // listed for react-doctor/exhaustive-deps; they never change
        // identity, so `settleLayout` is still recreated only when
        // `applyPositions` changes.
    }, [applyPositions, itemsRef, wrapperEls, activeCardIdRef, errorsRef, collapsedHeightsRef]);

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
        // Deps: `applyPositions`/`settleLayout` + `heightAnimRef` (stable ref)
        // listed for react-doctor/exhaustive-deps.
    }, [applyPositions, settleLayout, heightAnimRef]);

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
        // Deps: the three callbacks + stable refs threaded through `params`
        // (listed for react-doctor/exhaustive-deps; never change identity).
    }, [settleLayout, startHeightTween, applyPositions, heightAnimRef, itemsRef, wrapperEls]);

    useLayoutEffect(() => {
        const activeChanged = prevActiveCardIdRef.current !== activeCardId;
        prevActiveCardIdRef.current = activeCardId;
        updateLayoutPositions({ animateHeightChange: activeChanged });
    }, [activeCardId, items, updateLayoutPositions, prevActiveCardIdRef]);

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
    }, [draggingId, updateLayoutPositions, wrapperEls]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            // While ANY height tween is mid-flight — a card accordion tween OR the
            // active card's nested metadata drawer (which registers here via the
            // `heightAnimRef` it shares with the card) — take the cheap
            // frame-synced instant-push branch: read live wrapper heights and snap
            // lower cards along, exactly like the accordion tween's `onUpdate`
            // repositioning. Settling instead would restart glide tweens every
            // frame for the whole tween, which is what dropped frames during the
            // drawer animation. Dragging is excluded: the held card's height
            // snap is already handled by the drag-collapse `applyPositions(true)`
            // glide.
            if (heightAnimRef.current.size > 0 && draggingIdRef.current === null) {
                applyPositions(false);
                return;
            }
            updateLayoutPositions();
        });

        for (const el of wrapperEls.current.values()) {
            observer.observe(el);
        }

        return () => observer.disconnect();
    }, [items, updateLayoutPositions, wrapperEls, heightAnimRef, draggingIdRef, applyPositions]);

    return { applyPositions };
}

/**
 * GSAP Draggable reorder lifecycle — creates/kills one `Draggable` per card
 * (grip trigger, direction-aware midpoint crossing swaps with hysteresis),
 * drives the trailing-click suppression after a real drag, and kills all
 * instances on unmount. Dragging auto-collapses the held card to its compact
 * summary; on release the physical push engine re-expands it at its new slot.
 */
function useCardDragReorder(params: {
    items: QuestionDraft[];
    cardRefs: RefObject<Map<string, HTMLElement>>;
    applyPositions: (animate: boolean) => void;
    questionColumnRef: RefObject<HTMLDivElement | null>;
    wrapperEls: RefObject<Map<string, HTMLDivElement>>;
    itemsRef: RefObject<QuestionDraft[]>;
    draggingIdRef: RefObject<string | null>;
    positionedRef: RefObject<Set<string>>;
    collapsedHeightsRef: RefObject<Map<string, number>>;
    targetYMapRef: RefObject<Map<string, number>>;
    heightAnimRef: RefObject<Set<string>>;
    reorderRef: RefObject<QuizCanvas['reorderItems']>;
    suppressClickRef: RefObject<boolean>;
    suppressedCardIdRef: RefObject<string | null>;
    setDraggingId: Dispatch<SetStateAction<string | null>>;
}) {
    const {
        items,
        cardRefs,
        applyPositions,
        questionColumnRef,
        wrapperEls,
        itemsRef,
        draggingIdRef,
        positionedRef,
        collapsedHeightsRef,
        targetYMapRef,
        heightAnimRef,
        reorderRef,
        suppressClickRef,
        suppressedCardIdRef,
        setDraggingId,
    } = params;

    /** Live GSAP Draggable instance per mounted card (keyed by tempId). */
    const draggablesRef = useRef(new Map<string, Draggable>());
    /** True if real drag displacement occurred during the active press cycle. */
    const wasDraggedRef = useRef(false);
    /** Pending suppression-clear timer id (cleared on new suppression and unmount). */
    const suppressTimerRef = useRef<number | null>(null);

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
                    const compactHeight = compactHeightFor(collapsedHeightsRef, item.tempId);
                    gsap.set(wrapper, { height: compactHeight, overflow: 'hidden' });
                    applyPositions(true);
                    // Stale-cache guard: the collapsed-height cache is sampled
                    // while a card is INACTIVE, so an active card whose prompt
                    // just crossed the 1→2 line boundary has a SHORT stale
                    // entry — the forced height above would clip the badge row
                    // for the whole drag. One frame after the collapsed
                    // re-render commits (React flushes the `setDraggingId`
                    // update before the next frame), re-measure the natural
                    // collapsed height and raise the wrapper if the content is
                    // taller, healing the cache so every consumer (slot
                    // height, swap midpoint, later drags) agrees.
                    requestAnimationFrame(() => {
                        if (draggingIdRef.current !== item.tempId) return;
                        const natural = wrapper.scrollHeight;
                        if (natural > compactHeight) {
                            collapsedHeightsRef.current.set(item.tempId, natural);
                            gsap.set(wrapper, { height: natural });
                            applyPositions(false);
                        }
                    });
                },
                onDrag(this: Draggable) {
                    wasDraggedRef.current = true;
                    const wrapper = wrapperEls.current.get(item.tempId);
                    if (!wrapper) return;

                    const current = itemsRef.current;
                    // tempId → index lookup, built ONCE per drag frame (the
                    // swap loop below needs `to` for every other card and
                    // `from` for the held card — an in-loop findIndex would
                    // make the loop O(n²) on larger quizzes). tempIds are
                    // unique stable keys, so the Map is exact (no duplicate-
                    // key / first-match semantics to preserve).
                    const indexByTempId = new Map(
                        current.map((entry, index): [string, number] => [entry.tempId, index]),
                    );
                    const from = indexByTempId.get(item.tempId) ?? -1;
                    if (from === -1) return;

                    const dragCenterY = this.y + compactHeightFor(collapsedHeightsRef, item.tempId) / 2;

                    for (const [targetId, targetEl] of wrapperEls.current) {
                        if (targetId === item.tempId) continue;
                        const to = indexByTempId.get(targetId) ?? -1;
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
        // Deps: `items`/`cardRefs` (mount + card churn), `applyPositions`
        // (captured by the `onDragStart` closure). The remaining entries are
        // refs + the `setDraggingId` setter threaded through `params` — all
        // stable identities, so they never re-arm this effect; they're listed
        // only so react-doctor/exhaustive-deps sees the captures match.
        // `updateLayoutPositions` is deliberately NOT a dep — this effect
        // never reads it; listing it would re-kill and recreate every
        // Draggable instance on its identity changes. The layout hook owns
        // `updateLayoutPositions`.
    }, [items, cardRefs, applyPositions, itemsRef, wrapperEls, draggingIdRef, positionedRef, collapsedHeightsRef, targetYMapRef, heightAnimRef, reorderRef, suppressClickRef, suppressedCardIdRef, questionColumnRef, setDraggingId]);

    useEffect(() => () => {
        for (const instance of draggablesRef.current.values()) instance.kill();
        draggablesRef.current.clear();
        if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    }, []);
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
    bottomInset = 0,
    topInset = 0,
}: QuizCanvasQuestionListProps) {
    const items = draft.items;
    /** Sum of every question card's points — feeds the meta card's points-aware pass helper. */
    const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
    /** Held card tempId as React state — drives the clean collapsed-summary re-render during a drag. */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    /** Outer bounds container for canvas body flex row. */
    const canvasBodyRef = useRef<HTMLDivElement | null>(null);
    /** Outer bounds container (meta card + question grid + bottom dropzone) for GSAP Draggable. */
    const questionColumnRef = useRef<HTMLDivElement | null>(null);
    /** Live registry of question card wrapper elements keyed by tempId (shared with the toolbar lane). */
    const wrapperEls = useRef(new Map<string, HTMLDivElement>());
    /** tempId of the card currently held by GSAP Draggable. */
    const draggingIdRef = useRef<string | null>(null);
    /** Temporary flag to block the trailing click event right after a drop. */
    const suppressClickRef = useRef(false);
    /** tempId of the card whose trailing click is being suppressed (scoped to the dragged card only). */
    const suppressedCardIdRef = useRef<string | null>(null);
    /** tempIds placed at least once (skip initial jump animation). */
    const positionedRef = useRef(new Set<string>());
    /** Live Map of calculated target Y coordinates per card (tempId -> Y). */
    const targetYMapRef = useRef(new Map<string, number>());
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

    // Live snapshots so Draggable closures never read stale state. Synced in
    // a LAYOUT effect — NOT during render (React can replay or discard render
    // work, so render-phase ref writes can leak from UI that never commits),
    // and NOT in a passive effect: the section hooks' layout effects call
    // `updateLayoutPositions` → `settleLayout` → `applyPositions`, which read
    // these refs in the same commit — the sync must run before them, in the
    // layout pass (declaration order = execution order).
    const itemsRef = useRef(items);
    const activeCardIdRef = useRef(activeCardId);
    const errorsRef = useRef(errors);
    const reorderRef = useRef(canvas.reorderItems);
    useLayoutEffect(() => {
        itemsRef.current = items;
        activeCardIdRef.current = activeCardId;
        errorsRef.current = errors;
        reorderRef.current = canvas.reorderItems;
    });

    // Accordion layout orchestration (applyPositions / settleLayout / height
    // tweens + their layout effects). The returned `applyPositions` is the
    // drag lifecycle's `onDragStart` collapse push.
    const { applyPositions } = useCardPositionLayout({
        items,
        activeCardId,
        draggingId,
        itemsRef,
        activeCardIdRef,
        errorsRef,
        wrapperEls,
        draggingIdRef,
        positionedRef,
        targetYMapRef,
        gridRef,
        collapsedHeightsRef,
        heightAnimRef,
        prevActiveCardIdRef,
    });

    // GSAP Draggable reorder lifecycle (create/kill per card, swap logic,
    // trailing-click suppression, unmount cleanup).
    useCardDragReorder({
        items,
        cardRefs,
        applyPositions,
        questionColumnRef,
        wrapperEls,
        itemsRef,
        draggingIdRef,
        positionedRef,
        collapsedHeightsRef,
        targetYMapRef,
        heightAnimRef,
        reorderRef,
        suppressClickRef,
        suppressedCardIdRef,
        setDraggingId,
    });

    const registerWrapper = useCallback((tempId: string, el: HTMLDivElement | null) => {
        if (el) wrapperEls.current.set(tempId, el);
        else wrapperEls.current.delete(tempId);
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
                            totalPoints={totalPoints}
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
                                                heightAnimRef={heightAnimRef}
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
                    canvasBodyRef={canvasBodyRef}
                    cardWrapperMapRef={wrapperEls}
                    collapsedHeights={collapsedHeightsRef.current}
                    errors={errors}
                    gutter={GUTTER}
                    collapsedHeightFallback={COMPACT_HEIGHT}
                    canvas={canvas}
                    onFocusCard={onFocusCard}
                    onImportFromBank={onImportFromBank}
                    bottomInset={bottomInset}
                    topInset={topInset}
                />
            </div>
        </div>
    );
}
