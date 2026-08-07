import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';

/**
 * Transition glide duration (s) — matches `QuizCanvasQuestionList`'s
 * `REFLOW_DURATION` so the toolbar arrives alongside the card collapse.
 */
const REFLOW_DURATION = 0.35;
/** Drift-verify nudge duration (s). */
const FOLLOW_DURATION = 0.12;
/** Consecutive frames a signal must hold before the loop treats it as settled. */
const SETTLE_FRAMES = 6;
/** Sub-pixel tolerance (px) below which a frame counts as settled. */
const SETTLE_EPSILON = 0.5;

// Deterministic error-callout estimate (see `errorCallout` in
// QuizCanvasQuestionCard): 8px top + 8px bottom padding, ~18px per 12px-font
// line, ~55 chars per line at the card's ~660px content width.
const CALLOUT_PADDING_VERTICAL = 16;
const CALLOUT_LINE_HEIGHT = 18;
const CALLOUT_CHARS_PER_LINE = 90; // ~12px font in a ~660px card body

/**
 * Deterministic estimate of a collapsed card's error-callout height, derived
 * from the message count/length in the `errors` prop — never a live DOM
 * measurement. Deliberately approximate: the drift-verify phase of the follow
 * loop is the intended corrector. Do NOT "improve" this into a
 * `getBoundingClientRect` call — that would reintroduce the mid-transition
 * measurement race this resting-position model exists to avoid.
 */
function estimateCalloutHeight(errors: string[]): number {
    const lines = errors.reduce(
        (total, message) => total + Math.max(1, Math.ceil(message.length / CALLOUT_CHARS_PER_LINE)),
        0,
    );
    return CALLOUT_PADDING_VERTICAL + lines * CALLOUT_LINE_HEIGHT;
}

const styles = stylex.create({
    toolbarLane: {
        width: 56,
        flexShrink: 0,
        position: 'relative', // Shared coordinate space anchor
        height: '100%',
        '@media (max-width: 639px)': {
            width: 0,
        },
    },
    toolbarAbsoluteWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 'fit-content',
        willChange: 'transform',
        '@media (max-width: 639px)': {
            position: 'static',
            width: 'auto',
            willChange: 'auto',
        },
    },
});

export interface QuizCanvasToolbarLaneProps {
    items: QuestionDraft[];
    activeCardId: string | null;
    draggingId: string | null;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    gridRef?: RefObject<HTMLDivElement | null>;
    targetYMap?: Map<string, number>;
    layoutVersion?: number;
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    /**
     * Self-healing per-card RESTING (collapsed) heights, sampled by
     * `QuizCanvasQuestionList.settleLayout` for inactive, error-free cards.
     */
    collapsedHeights?: Map<string, number>;
    /** Current save-validation errors keyed by tempId — drives the callout bump. */
    errors?: QuizDraftErrors | null;
    /** Inter-card gap (px) — `QuizCanvasQuestionList`'s GUTTER. */
    gutter?: number;
    /** Fallback collapsed height for never-sampled cards — `QuizCanvasQuestionList`'s COMPACT_HEIGHT. */
    collapsedHeightFallback?: number;
    canvas: QuizCanvas;
    onFocusCard: (tempId: string) => void;
    onImportFromBank: (index: number) => void;
}

/**
 * Decoupled right toolbar lane component (rAF Follow Loop — Resting-Position
 * Model).
 *
 * The toolbar glides toward the active card's RESTING top: where its top edge
 * WILL be once every card above it is at its resting (collapsed) height. That
 * target is computed from state — the per-card collapsed-height cache (with a
 * `COMPACT_HEIGHT`-style fallback for never-sampled cards) plus a
 * deterministic error-callout estimate from the `errors` prop — and is a
 * CONSTANT while the layout animates. There is nothing to race against, no
 * timing bet, and no wait: the one 0.35s glide runs in parallel with the card
 * collapse, and they arrive together.
 *
 * - Transition: while the live layout is still moving (collapse/reflow), issue
 *   ONE long glide to the constant resting target. Chasing a constant means no
 *   dip/wobble (the target never moves under us) and no re-issued tween drag.
 * - Drift-verify: once the live position holds still for `SETTLE_FRAMES`,
 *   reality wins — if the estimate missed (e.g. callout line-count
 *   approximation), the loop corrects with short snappy nudges, then stops
 *   polling.
 * - Cache contract: heights come from `QuizCanvasQuestionList`'s self-healing
 *   `collapsedHeightsRef` (error-free inactive cards at settle; callout
 *   mount/unmount re-samples via ResizeObserver). The old active card's
 *   collapsed height is its cache entry (last sampled while inactive) — never
 *   a live read of its mid-collapse rect.
 * - Idle wake: `ResizeObserver` on the target node + the title card (its
 *   height change moves the grid, shifting the resting target) + `window
 *   resize`.
 * - Drag freeze: while a card is dragged the loop is suspended (toolbar stays
 *   frozen); on release the `isDragging` dependency re-runs it and it glides
 *   to the resting target at the new slot.
 * - Meta Card fallback: anchors at the lane origin (`y = 0`) beside the title
 *   card when `activeCardId` is null or not found.
 * - Mobile (<640px): clears inline transforms so the fixed viewport bottom bar
 *   operates cleanly.
 */
export function QuizCanvasToolbarLane({
    items,
    activeCardId,
    draggingId,
    titleCardRef,
    gridRef,
    canvasBodyRef,
    cardWrapperMapRef,
    collapsedHeights,
    errors,
    gutter = 20,
    collapsedHeightFallback = 76,
    canvas,
    onFocusCard,
    onImportFromBank,
}: QuizCanvasToolbarLaneProps) {
    const toolbarWrapperRef = useRef<HTMLDivElement | null>(null);
    /** True while the follow loop is idle (has stopped polling) — gates lazy wake-ups. */
    const followLoopSettledRef = useRef(true);

    const isDragging = draggingId !== null;

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const query = window.matchMedia('(max-width: 639px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(query.matches);

        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
    }, []);

    const activeIndex = items.findIndex((item) => item.tempId === activeCardId);
    const isMetaCard = activeCardId === null || activeIndex === -1;
    const effectiveIndex = isMetaCard ? -1 : activeIndex;

    // Latest-items snapshot for the follow loop. `items` is deliberately NOT
    // an effect dependency: the resting sum over cards above the target is
    // commutative, so any reorder that changes WHICH cards are above also
    // changes `effectiveIndex`, while typing only reorders/regrows cards below
    // the target (resting target unchanged). Syncing in a passive effect keeps
    // the loop from re-arming on every keystroke without a render-time ref
    // write.
    const itemsRef = useRef(items);
    useEffect(() => {
        itemsRef.current = items;
    });

    // Restart counter for the follow loop — bumped by the wake observers when
    // geometry changes while the loop is idle. Re-running the loop effect is
    // cheap: it re-arms the rAF poll and re-glides/re-verifies within a few
    // frames.
    const [wakeTick, setWakeTick] = useState(0);
    const wakeFollowLoop = useCallback(() => setWakeTick((tick) => tick + 1), []);

    // 1. rAF follow loop — the single owner of the toolbar's Y (Resting-Position
    //    Model + drift-verify). Handles focus changes, reorders, error-callout
    //    toggles, drag freeze/release, and mobile clearing. The wake observers
    //    below only nudge this loop to restart; they never tween the wrapper.
    useEffect(() => {
        const wrapper = toolbarWrapperRef.current;
        if (isMobile) {
            followLoopSettledRef.current = true;
            if (wrapper) {
                gsap.killTweensOf(wrapper, 'y');
                gsap.set(wrapper, { clearProps: 'transform,y' });
            }
            return;
        }

        // Drag freeze: keep the toolbar exactly where it is while a card is
        // held. When the drag ends, `isDragging` flips and this effect re-runs,
        // gliding to the resting target at the active card's new slot.
        if (isDragging) return;

        // Resting target: the active card's top once every card above it is at
        // its resting (collapsed) height. Computed from state — cache +
        // fallback + deterministic callout estimate — so it is a constant while
        // the layout animates (no live read of anything mid-transition).
        const computeRestingTargetY = () => {
            if (effectiveIndex < 0) return 0;
            const bodyNode = canvasBodyRef?.current;
            const gridNode = gridRef?.current;
            if (!bodyNode || !gridNode) return 0;
            const gridTop = gridNode.getBoundingClientRect().top - bodyNode.getBoundingClientRect().top;
            let y = gridTop;
            for (let k = 0; k < effectiveIndex; k += 1) {
                const card = itemsRef.current[k];
                const cardErrors = errors?.items[card.tempId] ?? [];
                const base = collapsedHeights?.get(card.tempId) ?? collapsedHeightFallback;
                y += base + (cardErrors.length > 0 ? estimateCalloutHeight(cardErrors) : 0) + gutter;
            }
            return Math.max(0, y);
        };

        followLoopSettledRef.current = false;
        let rafId = 0;
        let framesStable = 0; // frames the toolbar has sat at its target
        let liveStableFrames = 0; // frames the LIVE target position has held still
        let lastLiveY: number | null = null;
        let glideIssued = false;

        const tick = () => {
            const bodyNode = canvasBodyRef?.current;
            const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
            const targetNode = activeNode ?? titleCardRef?.current ?? null;

            if (targetNode && bodyNode && wrapper) {
                const liveY = Math.max(0, targetNode.getBoundingClientRect().top - bodyNode.getBoundingClientRect().top);

                // Layout-stability detector: while cards are collapsing/reflowing
                // the live position keeps moving → trust the constant resting
                // estimate. Once it holds still for SETTLE_FRAMES, reality wins.
                if (lastLiveY !== null && Math.abs(liveY - lastLiveY) >= SETTLE_EPSILON) {
                    liveStableFrames = 0;
                } else {
                    liveStableFrames += 1;
                }
                lastLiveY = liveY;

                const layoutSettled = liveStableFrames >= SETTLE_FRAMES;
                const currentY = gsap.getProperty(wrapper, 'y') as number;

                if (!layoutSettled) {
                    // Transition: ONE long glide to the constant resting target,
                    // issued once — the target is fixed, so re-issuing would only
                    // drag the tween out. The card collapse runs in parallel;
                    // both are 0.35s power2.out, so they arrive together.
                    if (!glideIssued) {
                        glideIssued = true;
                        gsap.to(wrapper, {
                            y: computeRestingTargetY(),
                            duration: REFLOW_DURATION,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                } else {
                    // Drift-verify: the estimate can be slightly off (callout
                    // line-count approximation). Now that the layout settled,
                    // trust the live position and correct with short snappy
                    // nudges; once clean for SETTLE_FRAMES, stop polling.
                    const delta = liveY - currentY;
                    if (Math.abs(delta) < SETTLE_EPSILON) {
                        framesStable += 1;
                    } else {
                        framesStable = 0;
                        gsap.to(wrapper, {
                            y: liveY,
                            duration: FOLLOW_DURATION,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                }
            }

            if (framesStable < SETTLE_FRAMES || liveStableFrames < SETTLE_FRAMES) {
                rafId = requestAnimationFrame(tick);
            } else {
                followLoopSettledRef.current = true;
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
        // Deps: `activeCardId`/`effectiveIndex`/`errors` change the resting
        // computation (focus change, reorder, error-callout toggles); `items` is
        // read via `itemsRef` (see above — re-arming on every keystroke would
        // defeat the settle-stop); `wakeTick` (trigger-only) restarts after idle
        // wakes; the refs keep the loop fresh against the live DOM.
    }, [isMobile, activeCardId, effectiveIndex, errors, isDragging, wakeTick, gutter, collapsedHeightFallback, canvasBodyRef, cardWrapperMapRef, titleCardRef, gridRef, collapsedHeights]);

    // 2. Idle wake observers — restart the follow loop when geometry changes
    //    while it is stopped. Observes the target node AND the title card (its
    //    height change moves the grid, shifting the resting target).
    useEffect(() => {
        if (isMobile) return;

        const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
        const targetNode = activeNode ?? titleCardRef?.current ?? null;
        if (!targetNode) return;

        // `isDragging` is read from this closure (re-created when the drag
        // state flips) so no ref is mutated during render.
        const wakeIfIdle = () => {
            if (isDragging) return;
            if (!followLoopSettledRef.current) return;
            wakeFollowLoop();
        };

        const observer = new ResizeObserver(wakeIfIdle);
        observer.observe(targetNode);
        const metaNode = titleCardRef?.current;
        if (metaNode && metaNode !== targetNode) observer.observe(metaNode);

        const handleResize = () => wakeIfIdle();
        window.addEventListener('resize', handleResize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [isMobile, activeCardId, isDragging, cardWrapperMapRef, titleCardRef, wakeFollowLoop]);

    return (
        <div {...stylex.props(styles.toolbarLane)}>
            <div
                ref={toolbarWrapperRef}
                {...stylex.props(styles.toolbarAbsoluteWrapper)}
            >
                <QuizCanvasCardToolbar
                    index={effectiveIndex}
                    totalItems={items.length}
                    onAddBelow={() => onFocusCard(canvas.addItemAt(isMetaCard ? 0 : effectiveIndex))}
                    onDuplicate={() => {
                        if (activeCardId) canvas.duplicateItem(activeCardId);
                    }}
                    onMoveUp={() => {
                        if (!isMetaCard) canvas.reorderItems(effectiveIndex, effectiveIndex - 1);
                    }}
                    onMoveDown={() => {
                        if (!isMetaCard) canvas.reorderItems(effectiveIndex, effectiveIndex + 1);
                    }}
                    onImportFromBank={() => onImportFromBank(isMetaCard ? 0 : effectiveIndex)}
                    onDelete={() => {
                        if (activeCardId) canvas.deleteItem(activeCardId);
                    }}
                />
            </div>
        </div>
    );
}
