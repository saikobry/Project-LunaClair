import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useFocusMode } from '../../../app/providers/FocusModeContext';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizCanvas } from './hooks/useQuizCanvas';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';
import { QuizCanvasPinVisualizer } from './QuizCanvasPinVisualizer';
import { readVelocity, estimateCalloutHeight, type VelocitySample } from './utils/toolbarMath';

/**
 * Transition glide duration (s) — matches `QuizCanvasQuestionList`'s
 * `REFLOW_DURATION` so the toolbar arrives alongside the card collapse.
 */
const REFLOW_DURATION = 0.35;
/** Drift-verify nudge duration (s) — the RESTING baseline; the chase scales it down toward `MIN_FOLLOW_DURATION` as scroll speed rises (keep-pace mode). */
const FOLLOW_DURATION = 0.12;
/** Consecutive frames a signal must hold before the loop treats it as settled. */
const SETTLE_FRAMES = 6;
/** Sub-pixel tolerance (px) below which a frame counts as settled. */
const SETTLE_EPSILON = 0.5;

/** Gap (px) from the visible edge when the toolbar is pinned. */
const PIN_MARGIN = 16;
/**
 * Unpin gate / hysteresis band (px). The PIN trigger is EDGE-TOUCH (pin the
 * moment the footprint's leading edge leaves the visible box); UNPIN requires
 * the footprint to clear BOTH visible edges by this much. The gap between the
 * pin line and this gate prevents anchored ↔ pinned flip-flop. Full rule:
 * `canvas/AGENTS.md` → Toolbar Lane → Hysteresis.
 */
const PIN_REENTER = 40;
/** Pin-in settle duration (s) — a quick ease from the toolbar's current on-screen position into the pinned position (continuous lock, no fade). */
const PIN_IN_DURATION = 0.25;
/**
 * Cross-edge flip glide speed (px/s). An edge-touch pin starts ±16px from its
 * spot (quick `PIN_IN_DURATION` lock); a pin SIDE flip starts a full viewport
 * span away, so the settle duration scales with the travel (capped at
 * `REFLOW_DURATION`) — a visible glide instead of a whip or a teleport.
 */
const PIN_GLIDE_SPEED = 1600;
/**
 * Velocity-aware chase + pin-anticipation tuning: `SCROLL_NOISE` (speed below
 * which content counts as parked), `VELOCITY_NORM` (speed at which the follow
 * duration halves), `MIN_FOLLOW_DURATION` (fling floor), and the pin-edge
 * anticipation lead (`VELOCITY_LEAD_S` × speed, capped at `MAX_PIN_LEAD` —
 * below `PIN_REENTER`, so the pin threshold never crosses the unpin gate).
 */
const SCROLL_NOISE = 60;
const VELOCITY_NORM = 1000;
const MIN_FOLLOW_DURATION = 0.035;
const VELOCITY_LEAD_S = 0.02;
const MAX_PIN_LEAD = 32;

/** Scroll-pin state. */
type PinState = 'anchored' | 'top' | 'bottom';

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
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    /**
     * Self-healing per-card RESTING (collapsed) heights, sampled by
     * `QuizCanvasQuestionList.settleLayout` for inactive, error-free cards.
     */
    collapsedHeights?: Map<string, number>;
    collapsedHeightsRef?: RefObject<Map<string, number>> | Map<string, number>;
    /** Current save-validation errors keyed by tempId — drives the callout bump. */
    errors?: QuizDraftErrors | null;
    /** Inter-card gap (px) — `QuizCanvasQuestionList`'s GUTTER. */
    gutter?: number;
    /** Fallback collapsed height for never-sampled cards — `QuizCanvasQuestionList`'s COMPACT_HEIGHT. */
    collapsedHeightFallback?: number;
    /**
     * Height (px) of app chrome (the shell's mobile bottom nav, ≤768px) that
     * overlaps the viewport's bottom edge. `innerHeight − bottomInset` is the
     * EFFECTIVE visible bottom for the pin trigger, the bottom-pin position,
     * and the unpin gate, so a bottom-pinned toolbar never slides under the
     * bar. Supplied by the app shell (0 at >768px and in Focus Mode).
     */
    bottomInset?: number;
    /**
     * Height (px) of the sticky builder header (`QuizCanvasHeader`) — the TOP
     * edge of the visible canvas area in viewport space. The pinned toolbar
     * locks at `topInset + PIN_MARGIN`, never over the header. Measured by the
     * builder via ResizeObserver (0 when the header is absent).
     */
    topInset?: number;
    canvas: QuizCanvas;
    onFocusCard: (tempId: string) => void;
    /** Scrolls a card into view only when it is mostly off-screen (move/duplicate/delete consequences). */
    onFocusCardIfOffScreen: (tempId: string) => void;
    onImportFromBank: (index: number) => void;
}

// ── Section hooks ──────────────────────────────────────────────────────────
// Motion subsystems live in focused hooks below; shared refs/state are created
// in the component and threaded in as parameters. Hook call order mirrors the
// original effect order, preserving layout-effect sequencing (the resting-
// target ref sync must run before the pin evaluator's layout pass).

/**
 * Resting target: the active card's top once every card above it is at its
 * resting (collapsed) height — computed from STATE (cache + fallback +
 * deterministic callout estimate), so it is a constant while the layout
 * animates. Shared by the chase, the pin evaluator, and the pinviz
 * visualizer so all act on the SAME stable position (full model:
 * `canvas/AGENTS.md` → Toolbar Lane).
 */
function useRestingTarget(params: {
    effectiveIndex: number;
    errors?: QuizDraftErrors | null;
    collapsedHeights?: Map<string, number>;
    collapsedHeightsRef?: RefObject<Map<string, number>> | Map<string, number>;
    collapsedHeightFallback: number;
    gutter: number;
    gridRef?: RefObject<HTMLDivElement | null>;
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    itemsRef: RefObject<QuestionDraft[]>;
}): {
    computeRestingTargetY: () => number;
    computeRestingTargetYRef: RefObject<() => number>;
} {
    const {
        effectiveIndex,
        errors,
        collapsedHeights,
        collapsedHeightsRef,
        collapsedHeightFallback,
        gutter,
        gridRef,
        canvasBodyRef,
        itemsRef,
    } = params;

    const computeRestingTargetY = useCallback(() => {
        if (effectiveIndex < 0) return 0;
        const bodyNode = canvasBodyRef?.current;
        const gridNode = gridRef?.current;
        if (!bodyNode || !gridNode) return 0;
        const gridTop = gridNode.getBoundingClientRect().top - bodyNode.getBoundingClientRect().top;
        const heightMap = collapsedHeightsRef && 'current' in collapsedHeightsRef
            ? collapsedHeightsRef.current
            : ((collapsedHeightsRef as Map<string, number>) ?? collapsedHeights);
        let y = gridTop;
        for (let k = 0; k < effectiveIndex; k += 1) {
            const card = itemsRef.current[k];
            const cardErrors = errors?.items[card.tempId] ?? [];
            const base = heightMap?.get(card.tempId) ?? collapsedHeightFallback;
            y += base + (cardErrors.length > 0 ? estimateCalloutHeight(cardErrors) : 0) + gutter;
        }
        return Math.max(0, y);
        // Deps: state/props + `itemsRef` (stable ref threaded through `params`,
        // listed for react-doctor/exhaustive-deps; never changes identity).
    }, [effectiveIndex, errors, collapsedHeights, collapsedHeightsRef, collapsedHeightFallback, gutter, gridRef, canvasBodyRef, itemsRef]);

    // Latest-callback ref — lets the pin evaluator and pinviz visualizer read
    // the freshest resting target WITHOUT re-arming their rAF/observer setups
    // on every errors/items change. Synced in a LAYOUT effect — NOT during
    // render (render-phase ref writes can leak from work React never commits)
    // and NOT in a passive effect: after a focus change the evaluator may run
    // a frame before a passive effect flushes, and one frame on the OLD
    // active card's resting top is exactly the stale-footprint flicker. This
    // hook runs before the pin evaluator, so its layout effect runs first.
    const computeRestingTargetYRef = useRef(computeRestingTargetY);
    useLayoutEffect(() => {
        computeRestingTargetYRef.current = computeRestingTargetY;
    });

    return { computeRestingTargetY, computeRestingTargetYRef };
}

/**
 * The rAF follow loop — the single owner of the toolbar's Y. Handles focus
 * changes, reorders, error-callout toggles, drag freeze/release, and mobile
 * clearing. Idle wake observers only nudge this loop to restart; they never
 * tween the wrapper. Full model: `canvas/AGENTS.md` → Toolbar Lane.
 */
function useToolbarFollowLoop(params: {
    isMobile: boolean;
    activeCardId: string | null;
    isDragging: boolean;
    pinState: PinState;
    wakeTick: number;
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    toolbarWrapperRef: RefObject<HTMLDivElement | null>;
    velocityRef: RefObject<VelocitySample>;
    pinnedRef: RefObject<boolean>;
    followLoopSettledRef: RefObject<boolean>;
    setPinState: Dispatch<SetStateAction<PinState>>;
    computeRestingTargetY: () => number;
}) {
    const {
        isMobile,
        activeCardId,
        isDragging,
        pinState,
        wakeTick,
        canvasBodyRef,
        cardWrapperMapRef,
        titleCardRef,
        toolbarWrapperRef,
        velocityRef,
        pinnedRef,
        followLoopSettledRef,
        setPinState,
        computeRestingTargetY,
    } = params;

    /**
     * Effect Event mirror of `computeRestingTargetY` — the rAF `tick` is its
     * only caller, so the chase must NOT re-subscribe when the callback's
     * identity changes (every errors/effectiveIndex recomputation); re-arming
     * would kill the loop mid-glide and re-issue the one-glide. Declared here
     * because an Effect Event must not leave the hook/effect that owns it.
     */
    const computeRestingTargetYEvent = useEffectEvent(computeRestingTargetY);

    useEffect(() => {
        const wrapper = toolbarWrapperRef.current;
        if (isMobile) {
            followLoopSettledRef.current = true;
            // Leaving the pin state too — otherwise returning to desktop would
            // leave the chase suspended forever with pin styles already cleared.
            pinnedRef.current = false;
            setPinState('anchored');
            if (wrapper) {
                gsap.killTweensOf(wrapper);
                // Clear any scroll-pin styles too (fixed positioning would
                // otherwise override the mobile static/float layout).
                gsap.set(wrapper, { clearProps: 'position,top,bottom,left,zIndex,transform,y' });
            }
            return;
        }

        // Drag freeze: keep the toolbar exactly where it is while a card is
        // held; the drag-end re-run glides to the resting target at the new slot.
        if (isDragging) return;

        // Pinned freeze: a fixed toolbar lives outside the chase's coordinate
        // space; the evaluator resumes the chase on unpin.
        if (pinState !== 'anchored') return;

        followLoopSettledRef.current = false;
        let rafId = 0;
        let framesStable = 0; // frames the toolbar has sat at its target
        let liveStableFrames = 0; // frames the LIVE target position has held still
        let lastLiveY: number | null = null;
        let glideIssued = false;

        const tick = () => {
            // Scroll-pinned: the evaluator set `position: fixed` outside React;
            // this loop may tick once more before the `pinState` commit cleans
            // it up. A tween here would fly the fixed wrapper to a content-space
            // coordinate — bail; the evaluator resumes the chase on unpin.
            if (pinnedRef.current) return;

            // Scroll speed this frame (decaying once scrolling stops) — drives
            // keep-pace chasing and the pin-anticipation lead.
            const vel = readVelocity(velocityRef.current, performance.now());
            const scrolling = vel > SCROLL_NOISE;

            const bodyNode = canvasBodyRef?.current;
            const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
            const targetNode = activeNode ?? titleCardRef?.current ?? null;

            if (targetNode && bodyNode && wrapper) {
                const liveY = Math.max(0, targetNode.getBoundingClientRect().top - bodyNode.getBoundingClientRect().top);

                // Layout-stability detector: while cards collapse/reflow the
                // live position keeps moving → trust the resting estimate;
                // once it holds still for `SETTLE_FRAMES`, reality wins.
                if (lastLiveY !== null && Math.abs(liveY - lastLiveY) >= SETTLE_EPSILON) {
                    liveStableFrames = 0;
                } else {
                    liveStableFrames += 1;
                }
                lastLiveY = liveY;

                const layoutSettled = liveStableFrames >= SETTLE_FRAMES;
                const currentY = gsap.getProperty(wrapper, 'y') as number;

                // Velocity-scaled follow duration (keep-pace mode).
                const followDuration = Math.max(
                    MIN_FOLLOW_DURATION,
                    Math.min(FOLLOW_DURATION, (FOLLOW_DURATION * VELOCITY_NORM) / (VELOCITY_NORM + vel)),
                );

                if (scrolling) {
                    // Keep-pace mode: re-target the LIVE position with the
                    // velocity-scaled duration; `glideIssued` resets so a fresh
                    // one-glide is issued once the fling ends while the layout
                    // is still collapsing. Signal is SCROLL speed, not `liveY`
                    // deltas: `liveY` is content-space, so a pure scroll leaves
                    // it static while the toolbar rides glued; convergence is
                    // only needed when a fling starts mid-convergence, and
                    // fling speed is what sets the pin deadline.
                    glideIssued = false;
                    const delta = liveY - currentY;
                    if (Math.abs(delta) < SETTLE_EPSILON) {
                        framesStable += 1;
                    } else {
                        framesStable = 0;
                        gsap.to(wrapper, {
                            y: liveY,
                            duration: followDuration,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                } else if (!layoutSettled) {
                    // ONE long glide to the constant resting target, issued
                    // once — re-issuing would only drag the tween out.
                    if (!glideIssued) {
                        glideIssued = true;
                        gsap.to(wrapper, {
                            y: computeRestingTargetYEvent(),
                            duration: REFLOW_DURATION,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                } else {
                    // Drift-verify: the estimate can be slightly off (callout
                    // line-count approximation); with the layout settled, correct
                    // with short nudges, then stop polling.
                    const delta = liveY - currentY;
                    if (Math.abs(delta) < SETTLE_EPSILON) {
                        framesStable += 1;
                    } else {
                        framesStable = 0;
                        gsap.to(wrapper, {
                            y: liveY,
                            duration: followDuration,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                }
            }

            if (scrolling && framesStable >= SETTLE_FRAMES) {
                // Glued while actively scrolling: a static transform rides the
                // scroll 1:1. On fling end the wake observers / evaluator resume.
                followLoopSettledRef.current = true;
            } else if (framesStable < SETTLE_FRAMES || liveStableFrames < SETTLE_FRAMES) {
                rafId = requestAnimationFrame(tick);
            } else {
                followLoopSettledRef.current = true;
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
        // Deps: `activeCardId` re-arms on focus changes; `items` is read via
        // `itemsRef` (re-arming on every keystroke would defeat the settle-
        // stop); `wakeTick` is trigger-only. The refs + setter are stable —
        // listed for react-doctor/exhaustive-deps. The resting target is
        // deliberately NOT a dep: the tick reads it via
        // `computeRestingTargetYEvent` (an Effect Event), which always sees
        // the latest value without re-subscribing the loop.
    }, [isMobile, activeCardId, isDragging, pinState, wakeTick, canvasBodyRef, cardWrapperMapRef, titleCardRef, toolbarWrapperRef, velocityRef, pinnedRef, followLoopSettledRef, setPinState]);
}

/**
 * Scroll pinning — geometry evaluator (full model: `canvas/AGENTS.md` →
 * Toolbar Lane). Owns the activation-detection ref (`prevActiveCardIdRef`)
 * and the inset-change ref (`prevBottomInsetRef`); an activation re-arm runs
 * one RELAXED evaluation (zero hysteresis margin + zero velocity lead) so the
 * toolbar reacts to a card click in the same frame.
 */
function useToolbarPinEvaluator(params: {
    isMobile: boolean;
    isDragging: boolean;
    activeCardId: string | null;
    pinState: PinState;
    isFocusMode: boolean;
    /**
     * Structural-move / geometry-change wake (`wakeTick`): re-arms this
     * evaluator so a move/insert/delete that shifts the resting target WITHOUT
     * a scroll event re-runs the pin decision against the NEW footprint —
     * without it the evaluator keeps sleeping (RO fires on size, not position)
     * and a move-up could glide the toolbar up PAST the pin line.
     */
    wakeTick: number;
    bottomInset: number;
    topInset: number;
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    gridRef?: RefObject<HTMLDivElement | null>;
    toolbarWrapperRef: RefObject<HTMLDivElement | null>;
    velocityRef: RefObject<VelocitySample>;
    pinnedRef: RefObject<boolean>;
    computeRestingTargetYRef: RefObject<() => number>;
    setPinState: Dispatch<SetStateAction<PinState>>;
}) {
    const {
        isMobile,
        isDragging,
        activeCardId,
        pinState,
        isFocusMode,
        wakeTick,
        bottomInset,
        topInset,
        canvasBodyRef,
        cardWrapperMapRef,
        titleCardRef,
        gridRef,
        toolbarWrapperRef,
        velocityRef,
        pinnedRef,
        computeRestingTargetYRef,
        setPinState,
    } = params;

    /**
     * Last `bottomInset` the evaluator ran with — detects INSET-DRIVEN re-arms
     * (a Focus Mode toggle at ≤768px), which must animate the pinned offset
     * instead of snapping it (see the re-arm branch below).
     */
    const prevBottomInsetRef = useRef(bottomInset);

    /**
     * Last `activeCardId` the evaluator ran with — detects ACTIVATION re-arms.
     * Those bypass the scroll-hysteresis band (zero `PIN_REENTER` margin and
     * zero velocity lead): a deliberate click cannot flip-flop, so the toolbar
     * reacts to the click in the same frame instead of holding the old pin
     * until the 40px full-fit margin clears.
     */
    const prevActiveCardIdRef = useRef(activeCardId);

    useEffect(() => {
        // Activation detection — synced FIRST (before the isMobile/isDragging
        // guard; it only touches a ref) so the ref never goes stale: every
        // re-arm with a changed `activeCardId` is an activation whose first
        // evaluation must bypass the hysteresis band (see `relaxed`).
        const activated = prevActiveCardIdRef.current !== activeCardId;
        prevActiveCardIdRef.current = activeCardId;

        if (isMobile || isDragging) return;

        const wrapper = toolbarWrapperRef.current;
        const laneNode = wrapper?.parentElement;
        const bodyNode = canvasBodyRef?.current;
        if (!wrapper || !laneNode || !bodyNode) return;

        // Cheap sanity guard only — `evaluate()` is fully state-derived; do
        // NOT re-introduce a live-rect read here (that is the transient-pin
        // bug this resting-footprint fix removes).
        const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
        const targetNode = activeNode ?? titleCardRef?.current ?? null;
        if (!targetNode) return;

        // Local mirror of `pinState` — dedups DOM work; `setPinState` drives
        // the chase's freeze/resume. Initialized FROM the React state: a re-run
        // while pinned must start in sync with the DOM, or the first
        // `applyPin('anchored')` would early-return and leave the toolbar
        // stuck fixed.
        let current: 'anchored' | 'top' | 'bottom' = pinState;

        // Shared pin geometry writer — positions the fixed toolbar in the
        // lane's column against the visible box. Declared BEFORE `applyPin`
        // (which calls it): calling a later `const` throws a TDZ
        // ReferenceError — this exact trap bit us once.
        const setPinGeometry = () => {
            const laneRect = laneNode.getBoundingClientRect();
            const effectiveBottom = window.innerHeight - bottomInset;
            gsap.set(wrapper, {
                left: laneRect.left,
                top: current === 'top' ? topInset + PIN_MARGIN : 'auto',
                bottom: current === 'bottom' ? window.innerHeight - effectiveBottom + PIN_MARGIN : 'auto',
            });
        };

        // The lane's horizontal position can shift while pinned: the workspace
        // is centered, the sidebar rail width animates on Focus Mode toggles,
        // and the recovery banner can mount above. Two signals re-read the
        // pinned geometry: the ResizeObserver below (box-size changes) and the
        // window `resize` listener (a width resize recenters the capped body
        // and slides the lane WITHOUT resizing any observed box, which RO
        // misses entirely).
        const refreshPin = () => {
            if (current === 'anchored') return;
            setPinGeometry();
        };

        const applyPin = (next: 'anchored' | 'top' | 'bottom') => {
            if (next === current) return;
            current = next;
            pinnedRef.current = next !== 'anchored';
            setPinState(next);

            if (next === 'anchored') {
                // Unpin without a jump: convert the toolbar's CURRENT (pinned,
                // viewport-relative) position into the chase's content space
                // (`wrapperRect.top − bodyRect.top`; both viewport-relative,
                // hence scroll-invariant — NO scrollTop term, or every unpin
                // would shift by the scroll amount). The set lands exactly
                // where it visually was; the return glide is owned by the
                // chase re-arm (`setPinState('anchored')`). Opacity is reset
                // in case an entrance tween was cut short.
                const wrapperRect = wrapper.getBoundingClientRect();
                const bodyRect = bodyNode.getBoundingClientRect();
                const docY = Math.max(0, wrapperRect.top - bodyRect.top);
                gsap.killTweensOf(wrapper, 'y,opacity');
                gsap.set(wrapper, { clearProps: 'position,top,bottom,left,zIndex' });
                gsap.set(wrapper, { y: docY, opacity: 1 });
                return;
            }

            // Pin: fix the toolbar to the viewport's VISIBLE box (below the
            // sticky header, above the bottom bar); `left` is captured
            // explicitly because `position: fixed` would snap to the viewport
            // edge. Continuous lock, not a materialize: edge-touch pins start
            // already on-screen, so capture where it visually is and ease the
            // transform into the pinned position — no fade. The settle runs on
            // TRANSFORM y, NOT top/bottom: `refreshPin` re-writes top/bottom
            // on the `pinState` re-arm ~1 frame later, which would cut a
            // top/bottom tween to a single frame.
            const effectiveBottom = window.innerHeight - bottomInset;
            const pinnedTop =
                next === 'top'
                    ? topInset + PIN_MARGIN
                    : effectiveBottom - PIN_MARGIN - wrapper.offsetHeight;
            // `fromY = wrapper.top − pinnedTop` is normally ±16 (edge-touch),
            // but a pin SIDE flip starts a full viewport span away. The clamp
            // is a TOP-EDGE guarantee ONLY: a violent fling can pin while the
            // toolbar is already clipped above the header, and an unclamped
            // glide would slide it DOWN through the header region. Bottom pins
            // are NEVER clamped — clamping a bottom-pin's large negative fromY
            // (a top→bottom flip) is exactly what once teleported the toolbar
            // (the geometry writer did all the travel; the settle animated a
            // 16px sliver).
            const fromY =
                next === 'top'
                    ? Math.max(wrapper.getBoundingClientRect().top - pinnedTop, -PIN_MARGIN)
                    : wrapper.getBoundingClientRect().top - pinnedTop;
            gsap.killTweensOf(wrapper, 'y,opacity');
            gsap.set(wrapper, { position: 'fixed', zIndex: 30, opacity: 1 });
            setPinGeometry();
            gsap.fromTo(
                wrapper,
                { y: fromY },
                {
                    y: 0,
                    // Scale the settle with the travel so a cross-edge flip
                    // glides (capped at `REFLOW_DURATION`); same-edge pins
                    // keep the quick `PIN_IN_DURATION` lock.
                    duration: Math.min(
                        REFLOW_DURATION,
                        Math.max(PIN_IN_DURATION, Math.abs(fromY) / PIN_GLIDE_SPEED),
                    ),
                    ease: 'power2.out',
                    overwrite: 'auto',
                },
            );
        };

        // One evaluation per frame, deduped via rAF (scroll events fire faster
        // than frames; the evaluator reads ~4 rects — trivial).
        let rafId: number | null = null;

        const evaluate = (relaxed = false) => {
            rafId = null;

            const bodyRect = bodyNode.getBoundingClientRect();
            const toolbarHeight = wrapper.offsetHeight; // layout height — unaffected by position mode
            // Degenerate frame (transient unmount/reflow): skip this frame
            // rather than emit a spurious pin.
            if (!toolbarHeight) return;

            // The toolbar's HYPOTHETICAL viewport rect if it were anchored to
            // the card right now: the card's RESTING doc-space top (the same
            // constant the chase targets) re-derived into viewport space via
            // `bodyRect.top`, plus the toolbar's own height. NOT the card's
            // live mid-animation rect — during a focus change the live top is
            // still below its resting top, and a live footprint transiently
            // pokes past the effective bottom → a spurious pin→unpin round
            // trip. The resting footprint is constant, so the decision is
            // stable; the wrapper's actual rect is meaningless while pinned.
            const restingTop = computeRestingTargetYRef.current();
            const hypoTop = bodyRect.top + restingTop;
            const hypoBottom = hypoTop + toolbarHeight;

            // EFFECTIVE bottom: the viewport's visible bottom minus app chrome
            // (`bottomInset`); a bottom-pinned toolbar must stay ABOVE the bar.
            const effectiveBottom = window.innerHeight - bottomInset;

            let next: 'anchored' | 'top' | 'bottom' = current;

            // Velocity-anticipation lead: pin while the footprint is still
            // this close to the edge on a fast scroll (`fromY` stays small, no
            // brief header overlap on a fling). Capped below `PIN_REENTER` so
            // the pin threshold never crosses the unpin gate. Zeroed on the
            // relaxed activation evaluation: a click has no scroll to
            // anticipate.
            const lead = relaxed
                ? 0
                : Math.min(
                      readVelocity(velocityRef.current, performance.now()) * VELOCITY_LEAD_S,
                      MAX_PIN_LEAD,
                  );
            // Unpin gate margin — 0 on the relaxed activation evaluation: the
            // card the user just clicked may sit inside the hysteresis band,
            // and a deliberate click cannot flip-flop. Scroll/resize ticks
            // keep the full `PIN_REENTER` margin.
            const gate = relaxed ? 0 : PIN_REENTER;
            if (hypoTop < topInset + lead) {
                // EDGE-TOUCH trigger: pin NOW, so the toolbar is already
                // pinned the moment it would start to clip under the header.
                next = 'top';
            } else if (hypoBottom > effectiveBottom - lead) {
                // Mirror case at the effective bottom edge.
                next = 'bottom';
            } else if (
                hypoTop >= topInset + gate &&
                hypoBottom <= effectiveBottom - gate
            ) {
                // Symmetric full-fit: unpin only when the footprint fits
                // entirely, with the hysteresis margin on both edges.
                next = 'anchored';
            }

            // Delegate the transition entirely to `applyPin` — it owns the
            // guard AND the state writes. The caller must NOT pre-set
            // `current` here: applyPin's guard would see `next === current`
            // and return without ever pinning.
            if (next !== current) {
                applyPin(next);
            }
        };

        const scheduleEvaluate = () => {
            if (rafId !== null) return;
            // Wrapped (not `requestAnimationFrame(evaluate)`): rAF would pass
            // the frame timestamp into the `relaxed` parameter.
            rafId = requestAnimationFrame(() => evaluate());
        };

        scheduleEvaluate();
        // Activation re-arm: run the relaxed evaluation ONCE, synchronously, so
        // a pinned toolbar does not stay glued to its old edge while the card
        // it was asked to follow sits elsewhere on screen.
        if (activated) {
            evaluate(true);
        }
        // Scroll-speed tracker — feeds the chase's velocity-scaled follow
        // duration and the pin-anticipation lead. EMA-smoothed and timestamped
        // so `readVelocity` decays it smoothly; `velocityRef` persists across
        // effect re-arms, so the last sample survives and decays rather than
        // being lost. Window-scroll mode: velocity comes from `window.scrollY`.
        let lastScrollTop = window.scrollY;
        let lastScrollAt = performance.now();
        let emaVelocity = 0;
        const onScroll = () => {
            const now = performance.now();
            const dt = Math.max(1, now - lastScrollAt);
            const inst = (Math.abs(window.scrollY - lastScrollTop) / dt) * 1000;
            emaVelocity = emaVelocity * 0.5 + inst * 0.5;
            velocityRef.current = { v: emaVelocity, at: now };
            lastScrollTop = window.scrollY;
            lastScrollAt = now;
            scheduleEvaluate();
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        // A window width resize recenters the maxWidth-capped canvas body,
        // sliding the lane horizontally — but ResizeObserver only reports
        // SIZE changes, and in the capped range no observed box changes size
        // (headless probe: zero RO callbacks during a width resize while the
        // lane moved ~110px). The `resize` event is the reliable signal; it
        // dispatches post-layout, so `refreshPin` always sees the new lane
        // position.
        const handleWindowResize = () => {
            refreshPin();
            scheduleEvaluate();
        };
        window.addEventListener('resize', handleWindowResize);

        // Re-read the pinned geometry when the wrapper/grid/title boxes change
        // (rail animation frames, banner mount, toolbar size) and re-evaluate
        // the pin decision when layout size changes (grid/meta growth moves
        // the card's doc-space top without any scroll event).
        const pinBoxObserver = new ResizeObserver(() => {
            refreshPin();
            scheduleEvaluate();
        });
        pinBoxObserver.observe(wrapper);
        if (gridRef?.current) pinBoxObserver.observe(gridRef.current);
        if (titleCardRef?.current) pinBoxObserver.observe(titleCardRef.current);

        // Re-armed while already pinned (e.g. a Focus Mode toggle re-runs this
        // effect via `isFocusMode`) — re-apply the pinned geometry so `left`
        // follows the shifted lane immediately.
        //
        // EXCEPTION — inset-driven re-arms (`bottomInset` changed): an instant
        // `refreshPin` would snap a bottom-pinned toolbar's offset in one
        // frame. Animate it instead. The slide runs on TRANSFORM y, NOT
        // `bottom`: animating `bottom` is per-frame layout cost at the moment
        // the toggle is busiest, and `refreshPin` re-writes top/bottom ~1
        // frame later on the `pinState` re-arm, which would cut a bottom
        // tween to a single frame (transform y is untouched by the geometry
        // writer, and `willChange: 'transform'` makes the slide
        // compositor-only). Only tween when the footprint still violates the
        // NEW effective bottom; if the freed space revealed the card, let the
        // evaluator un-pin next frame — its unpin handoff starts from the
        // toolbar's current visual spot. `willStayPinned` mirrors the
        // evaluator's unpin gate EXACTLY (both edges + margin), so the two
        // can only disagree if geometry changes within the same frame, which
        // self-corrects on the next scroll. A one-sided check could leave the
        // toolbar stuck at the OLD offset.
        const insetChanged = prevBottomInsetRef.current !== bottomInset;
        if (current === 'bottom' && insetChanged) {
            const newEffectiveBottom = window.innerHeight - bottomInset;
            const bodyRect = bodyNode.getBoundingClientRect();
            const toolbarH = wrapper.offsetHeight;
            const hypoTop = bodyRect.top + computeRestingTargetYRef.current();
            const hypoBottom = hypoTop + toolbarH;
            // Degenerate frame: default to tweening — the evaluator skips its
            // own decision this frame anyway.
            const willStayPinned =
                toolbarH === 0 ||
                !(
                    hypoTop >= topInset + PIN_REENTER &&
                    hypoBottom <= newEffectiveBottom - PIN_REENTER
                );
            if (willStayPinned) {
                // `newBottom` must match `setPinGeometry`'s bottom write
                // exactly (`bottomInset + PIN_MARGIN`) so the single layout
                // write doesn't fight the geometry writer's re-read.
                const newBottom = bottomInset + PIN_MARGIN;
                const targetTop = window.innerHeight - newBottom - wrapper.offsetHeight;
                // Read the LIVE visual top AFTER killing any in-flight tween:
                // the frozen transform still includes the current y offset, so
                // the fromTo starts exactly where the toolbar visually is.
                gsap.killTweensOf(wrapper, 'y,bottom');
                // Steady-state invariant: `fromY` reduces to exactly
                // `bottomInset − oldInset` — Focus ON slides down into the
                // freed space, Focus OFF slides back up.
                const fromY = wrapper.getBoundingClientRect().top - targetTop; // ±88, sign = direction
                gsap.set(wrapper, { bottom: newBottom });
                gsap.fromTo(
                    wrapper,
                    { y: fromY },
                    {
                        y: 0,
                        duration: REFLOW_DURATION,
                        ease: 'power2.out',
                        overwrite: 'auto',
                    },
                );
            }
        } else if (current !== 'anchored') {
            refreshPin();
        }
        prevBottomInsetRef.current = bottomInset;

        // Lane-drift poll: the sidebar rail animates its LAYOUT width on Focus
        // Mode toggles (GSAP) WITHOUT a `resize` event, and while the canvas
        // body is width-capped its observed boxes only SHIFT (RO fires on
        // size, not position) — so neither refresh signal fires and the pinned
        // toolbar's `left` would stay behind (it visually escapes the lane).
        // While pinned, sample the lane rect per frame until it holds still or
        // the budget expires, re-applying the pinned geometry each frame.
        let driftRaf = 0;
        let driftFrames = 0;
        let driftStableFrames = 0;
        let lastDriftLeft: number | null = null;
        const driftBudget = 30; // ~0.5s at 60fps — the 0.35s rail tween + slack
        if (current !== 'anchored') {
            const pollLaneDrift = () => {
                driftFrames += 1;
                const laneLeft = laneNode.getBoundingClientRect().left;
                if (lastDriftLeft !== null && Math.abs(laneLeft - lastDriftLeft) < 0.5) {
                    driftStableFrames += 1;
                } else {
                    driftStableFrames = 0;
                    if (current !== 'anchored') refreshPin();
                }
                lastDriftLeft = laneLeft;
                if (driftStableFrames >= 3 || driftFrames >= driftBudget) return;
                driftRaf = requestAnimationFrame(pollLaneDrift);
            };
            driftRaf = requestAnimationFrame(pollLaneDrift);
        }

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (driftRaf !== 0) cancelAnimationFrame(driftRaf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', handleWindowResize);
            pinBoxObserver.disconnect();
        };
        // Deps: `isFocusMode` is trigger-only (re-arms so `refreshPin` re-reads
        // the lane's `left` after the rail-width animation); `topInset` re-arms
        // on sticky-header height changes; `wakeTick` re-arms on structural
        // moves and idle wakes (the resting target shifted without any
        // scroll/resize/RO signal — see the param doc). The refs + setter are
        // stable — listed for react-doctor/exhaustive-deps.
    }, [isMobile, isDragging, activeCardId, pinState, isFocusMode, wakeTick, bottomInset, topInset, canvasBodyRef, cardWrapperMapRef, titleCardRef, gridRef, toolbarWrapperRef, pinnedRef, computeRestingTargetYRef, velocityRef, setPinState]);
}

/**
 * Toolbar lane component (rAF follow loop — resting-position model; full
 * algorithm: `canvas/AGENTS.md` → Toolbar Lane).
 *
 * The toolbar glides toward the active card's RESTING top (computed from
 * state — collapsed-height cache + deterministic callout estimate), a CONSTANT
 * while the layout animates: one 0.35s glide runs in parallel with the card
 * collapse, and they arrive together. Drift-verify lets reality win with short
 * nudges once the live position holds still. Scroll pinning is geometry-based
 * (see the pin evaluator); while pinned the chase is suspended and unpinning
 * converts the pinned viewport position back into content space so the chase
 * glides from where the toolbar visually was. Mobile (<640px): clears inline
 * transforms and any pin styles so the fixed bottom bar operates cleanly.
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
    collapsedHeightsRef,
    errors,
    gutter = 20,
    collapsedHeightFallback = 116,
    canvas,
    onFocusCard,
    onFocusCardIfOffScreen,
    onImportFromBank,
    bottomInset = 0,
    topInset = 0,
}: QuizCanvasToolbarLaneProps) {
    const toolbarWrapperRef = useRef<HTMLDivElement | null>(null);
    /** Shared scroll-speed sample (px/s + timestamp) — written by the evaluator's scroll listener, read by the chase and the pin lead. */
    const velocityRef = useRef<VelocitySample>({ v: 0, at: 0 });
    /** True while the follow loop is idle (has stopped polling) — gates lazy wake-ups. */
    const followLoopSettledRef = useRef(true);
    /**
     * True while the toolbar is pinned to a viewport edge. Set synchronously
     * by the pin evaluator (outside React's commit) so the chase rAF can never
     * tween the `position: fixed` wrapper in the one-frame gap between the
     * evaluator's DOM writes and the `pinState` commit.
     */
    const pinnedRef = useRef(false);
    /** Scroll-pin state — while not 'anchored' the follow loop is suspended. */
    const [pinState, setPinState] = useState<PinState>('anchored');

    // The sidebar rail animates its width on Focus Mode toggles (GSAP tween,
    // no `resize` event), shifting the lane horizontally while the toolbar may
    // be pinned — the pinning evaluator re-arms on this and re-reads `left`.
    const { isFocusMode } = useFocusMode();

    const isDragging = draggingId !== null;

    const isMobile = useSyncExternalStore(
        (notify) => {
            if (typeof window === 'undefined') return () => {};
            const query = window.matchMedia('(max-width: 639px)');
            query.addEventListener('change', notify);
            return () => query.removeEventListener('change', notify);
        },
        () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false),
        () => false,
    );

    const activeIndex = items.findIndex((item) => item.tempId === activeCardId);
    const isMetaCard = activeCardId === null || activeIndex === -1;
    const effectiveIndex = isMetaCard ? -1 : activeIndex;

    // Latest-items snapshot for the follow loop. `items` is deliberately NOT
    // an effect dependency: a reorder that changes WHICH cards are above the
    // target also changes `effectiveIndex`, while typing only affects cards
    // below it. A passive effect avoids re-arming on every keystroke without
    // a render-time ref write.
    const itemsRef = useRef(items);
    useEffect(() => {
        itemsRef.current = items;
    });

    // Restart counter for the follow loop — bumped by the wake observers when
    // geometry changes while the loop is idle.
    const [wakeTick, setWakeTick] = useState(0);
    const wakeFollowLoop = useCallback(() => setWakeTick((tick) => tick + 1), []);

    // Structural-move wake: a move/insert/delete above the active card shifts
    // its SLOT without changing `activeCardId`, and card wrappers only MOVE
    // (GSAP `y` — RO fires on size, not position), so nothing else restarts
    // the chase or the pin evaluator. Bump the wake tick whenever the
    // effective slot changes; both consumers re-arm on it.
    const prevEffectiveIndexRef = useRef(effectiveIndex);
    useEffect(() => {
        if (prevEffectiveIndexRef.current !== effectiveIndex) {
            prevEffectiveIndexRef.current = effectiveIndex;
            wakeFollowLoop();
        }
    }, [effectiveIndex, wakeFollowLoop]);

    // Resting target + its latest-callback ref — shared by the chase (the
    // one-glide endpoint), the pin evaluator (the pin/unpin footprint), and
    // the pinviz visualizer, so all act on the SAME stable position.
    const { computeRestingTargetY, computeRestingTargetYRef } = useRestingTarget({
        effectiveIndex,
        errors,
        collapsedHeights,
        collapsedHeightsRef,
        collapsedHeightFallback,
        gutter,
        gridRef,
        canvasBodyRef,
        itemsRef,
    });

    // rAF follow loop (the chase) — the single owner of the toolbar's Y.
    useToolbarFollowLoop({
        isMobile,
        activeCardId,
        isDragging,
        pinState,
        wakeTick,
        canvasBodyRef,
        cardWrapperMapRef,
        titleCardRef,
        toolbarWrapperRef,
        velocityRef,
        pinnedRef,
        followLoopSettledRef,
        setPinState,
        computeRestingTargetY,
    });


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

    // Scroll pinning — geometry evaluator (see the hook doc).
    useToolbarPinEvaluator({
        isMobile,
        isDragging,
        activeCardId,
        pinState,
        isFocusMode,
        wakeTick,
        bottomInset,
        topInset,
        canvasBodyRef,
        cardWrapperMapRef,
        titleCardRef,
        gridRef,
        toolbarWrapperRef,
        velocityRef,
        pinnedRef,
        computeRestingTargetYRef,
        setPinState,
    });

    return (
        <>
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
                            if (!activeCardId) return;
                            // The copy is the visible consequence — scroll it
                            // into view when it lands off-screen.
                            const copyTempId = canvas.duplicateItem(activeCardId);
                            onFocusCardIfOffScreen(copyTempId);
                        }}
                        onMoveUp={() => {
                            if (!isMetaCard) {
                                canvas.reorderItems(effectiveIndex, effectiveIndex - 1);
                                if (activeCardId) onFocusCardIfOffScreen(activeCardId);
                            }
                        }}
                        onMoveDown={() => {
                            if (!isMetaCard) {
                                canvas.reorderItems(effectiveIndex, effectiveIndex + 1);
                                if (activeCardId) onFocusCardIfOffScreen(activeCardId);
                            }
                        }}
                        onImportFromBank={() => onImportFromBank(isMetaCard ? 0 : effectiveIndex)}
                        onDelete={() => {
                            if (!activeCardId) return;
                            // Delete's consequence is the card that slides into
                            // the vacated slot (or the title card when the quiz
                            // becomes empty) — scroll THAT into view, still
                            // gated on being off-screen.
                            const deletedIndex = effectiveIndex;
                            canvas.deleteItem(activeCardId);
                            const replacement = items[deletedIndex + 1] ?? items[deletedIndex - 1];
                            if (replacement) {
                                onFocusCardIfOffScreen(replacement.tempId);
                            } else if (titleCardRef?.current) {
                                const rect = titleCardRef.current.getBoundingClientRect();
                                if (rect.bottom < 0 || rect.top > window.innerHeight) {
                                    titleCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }}
                    />
                </div>
            </div>
            {/* Debug overlay — mounts only with `?pinviz=1` (see component doc). */}
            <QuizCanvasPinVisualizer
                velocityRef={velocityRef}
                computeRestingTopRef={computeRestingTargetYRef}
                canvasBodyRef={canvasBodyRef}
                cardWrapperMapRef={cardWrapperMapRef}
                titleCardRef={titleCardRef}
                activeCardId={activeCardId}
                toolbarWrapperRef={toolbarWrapperRef}
                pinState={pinState}
                bottomInset={bottomInset}
                topInset={topInset}
            />
        </>
    );
}
