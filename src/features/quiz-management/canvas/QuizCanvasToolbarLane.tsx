import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
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
/**
 * Drift-verify nudge duration (s) — the RESTING baseline; the chase scales it
 * down toward MIN_FOLLOW_DURATION as scroll speed rises (keep-pace mode) so a
 * fast fling never leaves the toolbar trailing the card.
 */
const FOLLOW_DURATION = 0.12;
/** Consecutive frames a signal must hold before the loop treats it as settled. */
const SETTLE_FRAMES = 6;
/** Sub-pixel tolerance (px) below which a frame counts as settled. */
const SETTLE_EPSILON = 0.5;

/** Gap (px) from the visible edge when the toolbar is pinned. */
const PIN_MARGIN = 16;
/**
 * Unpin gate / hysteresis band (px). The PIN trigger itself is EDGE-TOUCH —
 * the toolbar pins the moment its hypothetical footprint's leading edge
 * leaves the viewport's visible box (top: `hypoTop < topInset`, the sticky
 * header's height; bottom: `hypoBottom > effectiveBottom = innerHeight −
 * bottomInset` — the viewport bottom minus any app chrome — so it is
 * ALREADY pinned as it starts to leave — no waiting for a clip. UNPIN
 * requires symmetric full-fit: the footprint must clear BOTH visible edges
 * by at least this much (top: `hypoTop >= topInset + this`; bottom:
 * `hypoBottom <= effectiveBottom − this`) before returning to the chase.
 * The gap between the pin line (at the edge) and this gate (this far
 * inside) is the hysteresis that prevents anchored ↔ pinned flip-flop when
 * a slow scroll stutters at a boundary.
 */
const PIN_REENTER = 40;
/** Pin-in settle duration (s) — a quick ease from the toolbar's current on-screen position into the pinned position (continuous lock, no fade). */
const PIN_IN_DURATION = 0.25;
/**
 * Cross-edge flip glide speed (px/s). The standard settle is
 * `PIN_IN_DURATION` because edge-touch pins start ±16px from their spot; a
 * pin SIDE flip (top ↔ bottom) starts ~a full viewport span away, so the
 * settle duration scales with the travel (capped at `REFLOW_DURATION`) — the
 * toolbar visibly glides between the edges instead of whipping (0.25s over
 * ~590px) or, with the old clamp, teleporting.
 */
const PIN_GLIDE_SPEED = 1600;
/**
 * Velocity-aware chase + pin-anticipation tuning:
 * - `SCROLL_NOISE`: scroll speed (px/s) below which the chase treats the
 *   content as parked and runs its normal transition/drift behavior.
 * - `VELOCITY_NORM`: the speed at which the follow duration is halved.
 * - `MIN_FOLLOW_DURATION`: floor for the follow tween on a fast fling.
 * - `VELOCITY_LEAD_S` × current speed → the anticipation lead (px) applied at
 *   the pin edges; `MAX_PIN_LEAD` caps it BELOW `PIN_REENTER` (40) so the pin
 *   threshold never crosses the unpin gate — the hysteresis gap always holds.
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
    /** Current save-validation errors keyed by tempId — drives the callout bump. */
    errors?: QuizDraftErrors | null;
    /** Inter-card gap (px) — `QuizCanvasQuestionList`'s GUTTER. */
    gutter?: number;
    /** Fallback collapsed height for never-sampled cards — `QuizCanvasQuestionList`'s COMPACT_HEIGHT. */
    collapsedHeightFallback?: number;
    /**
     * Height (px) of app chrome (the shell's mobile bottom nav, ≤768px) that
     * overlaps the viewport's bottom edge. The evaluator's bottom bound — the
     * pin-bottom trigger, the bottom-pin position, and the unpin gate's bottom
     * edge — all treat `innerHeight − bottomInset` as the EFFECTIVE visible
     * bottom, so a bottom-pinned toolbar never slides under the bar. Supplied
     * by the app shell from its declared `main` bottom padding (0 at >768px
     * and in Focus Mode, where the bar is absent).
     */
    bottomInset?: number;
    /**
     * Height (px) of the sticky builder header (`QuizCanvasHeader`) — the
     * TOP edge of the visible canvas area in viewport space. WINDOW-SCROLL
     * mode: the page owns the scroll, so the visible box is derived from
     * insets, not a scroller element's rect — `topInset` and `bottomInset`
     * bound the area the pinned toolbar may occupy. The pinned toolbar locks
     * at `topInset + PIN_MARGIN`, never over the header. Measured by the
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
// The toolbar lane's motion subsystems (resting-target computation, rAF follow
// loop, scroll-pin evaluator) live in focused hooks below so the component
// stays readable. Shared refs/state are created in the component and threaded
// in as parameters; hook call order mirrors the original effect order, which
// preserves layout-effect sequencing (the resting-target ref sync must run
// before the pin evaluator's layout pass).

/**
 * Resting target: the active card's top once every card above it is at its
 * resting (collapsed) height. Computed from STATE — cache + fallback +
 * deterministic callout estimate — so it is a constant while the layout
 * animates (no live read of anything mid-transition). Shared by the chase (the
 * one-glide endpoint), the pinning evaluator (the pin/unpin footprint), and
 * the pinviz visualizer, so all act on the SAME stable position.
 */
function useRestingTarget(params: {
    effectiveIndex: number;
    errors?: QuizDraftErrors | null;
    collapsedHeights?: Map<string, number>;
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
        let y = gridTop;
        for (let k = 0; k < effectiveIndex; k += 1) {
            const card = itemsRef.current[k];
            const cardErrors = errors?.items[card.tempId] ?? [];
            const base = collapsedHeights?.get(card.tempId) ?? collapsedHeightFallback;
            y += base + (cardErrors.length > 0 ? estimateCalloutHeight(cardErrors) : 0) + gutter;
        }
        return Math.max(0, y);
        // Deps: state/props + `itemsRef` (stable ref threaded through `params`,
        // listed for react-doctor/exhaustive-deps; never changes identity).
    }, [effectiveIndex, errors, collapsedHeights, collapsedHeightFallback, gutter, gridRef, canvasBodyRef, itemsRef]);

    // Latest-callback ref — lets the pin evaluator (and the pinviz visualizer)
    // read the freshest resting target WITHOUT re-arming their rAF/observer
    // setups on every errors/items change. Synced in a LAYOUT effect — NOT
    // during render (React can replay or discard render work, so render-phase
    // ref writes can leak from UI that never commits), and NOT in a passive
    // effect: after a focus change the evaluator/visualizer may evaluate a
    // frame before a passive effect flushes, and reading the OLD active
    // card's resting top for one frame is exactly the stale footprint that
    // produced the transient flicker. This hook is called before the pin
    // evaluator, so its layout effect runs first in the same commit pass.
    const computeRestingTargetYRef = useRef(computeRestingTargetY);
    useLayoutEffect(() => {
        computeRestingTargetYRef.current = computeRestingTargetY;
    });

    return { computeRestingTargetY, computeRestingTargetYRef };
}

/**
 * The rAF follow loop — the single owner of the toolbar's Y (Resting-Position
 * Model + drift-verify). Handles focus changes, reorders, error-callout
 * toggles, drag freeze/release, and mobile clearing. The idle wake observers
 * (still in the component) only nudge this loop to restart; they never tween
 * the wrapper. See the component docstring for the full model.
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
     * ONLY caller, so the chase must NOT re-subscribe when the resting-target
     * callback's identity changes (every `errors`/`effectiveIndex`
     * recomputation) — re-arming would kill the loop mid-glide and re-issue
     * the one-glide, the exact re-issued-tween drag the resting model avoids.
     * An Effect Event is non-reactive: it always calls the latest callback but
     * is never a dependency. Declared HERE because an Effect Event must not
     * leave the hook/effect that owns it.
     */
    const computeRestingTargetYEvent = useEffectEvent(computeRestingTargetY);

    useEffect(() => {
        const wrapper = toolbarWrapperRef.current;
        if (isMobile) {
            followLoopSettledRef.current = true;
            // Leaving the pin state too — otherwise returning to desktop would
            // leave the chase suspended forever (`pinState !== 'anchored'`
            // early return) with the pin styles already cleared.
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
        // held. When the drag ends, `isDragging` flips and this effect re-runs,
        // gliding to the resting target at the active card's new slot.
        if (isDragging) return;

        // Pinned freeze: while the toolbar is fixed to a viewport edge its
        // position lives outside the chase's content-space coordinate system;
        // the pinning evaluator resumes the chase (via `pinState`) on unpin.
        if (pinState !== 'anchored') return;

        followLoopSettledRef.current = false;
        let rafId = 0;
        let framesStable = 0; // frames the toolbar has sat at its target
        let liveStableFrames = 0; // frames the LIVE target position has held still
        let lastLiveY: number | null = null;
        let glideIssued = false;

        const tick = () => {
            // Scroll-pinned: the pinning evaluator set `position: fixed`
            // outside React, so this loop may tick once more before the
            // `pinState` commit cleans it up. A tween here would fly the fixed
            // wrapper to a content-space coordinate — bail and let the pinning
            // evaluator resume the chase on unpin.
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

                // Velocity-scaled follow duration: fast flings get short tweens
                // so the chase keeps pace with the card; at rest it degrades to
                // FOLLOW_DURATION.
                const followDuration = Math.max(
                    MIN_FOLLOW_DURATION,
                    Math.min(FOLLOW_DURATION, (FOLLOW_DURATION * VELOCITY_NORM) / (VELOCITY_NORM + vel)),
                );

                if (scrolling) {
                    // Keep-pace mode (actively scrolling): continuously re-target
                    // the LIVE position with the velocity-scaled duration — a fast
                    // fling must never leave the toolbar riding a stale 0.35s
                    // glide. `glideIssued` resets so a fresh one-glide-to-rest is
                    // issued once the fling ends while the layout is still
                    // collapsing. The no-overlap clamp (`liveY ≥ 0`) is unchanged
                    // — the toolbar never asks for a position above the body top.
                    //
                    // Why SCROLL speed is the signal (not `liveY` deltas): `liveY`
                    // is content-space — a pure scroll leaves it static while the
                    // toolbar rides along glued, so the only time the toolbar must
                    // CONVERGE during a scroll is when the fling starts while it
                    // is mid-convergence (focus change / collapse in flight). The
                    // fling's speed is exactly what sets the deadline (the pin
                    // fires when the card's edge arrives), so it scales the tween
                    // duration directly.
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
                    // Transition: ONE long glide to the constant resting target,
                    // issued once — the target is fixed, so re-issuing would only
                    // drag the tween out. The card collapse runs in parallel;
                    // both are 0.35s power2.out, so they arrive together.
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
                            duration: followDuration,
                            ease: 'power2.out',
                            overwrite: 'auto',
                        });
                    }
                }
            }

            if (scrolling && framesStable >= SETTLE_FRAMES) {
                // Glued while actively scrolling: a static transform rides the
                // scroll 1:1 — no need to keep polling. When the fling ends the
                // pinned evaluator / wake observers resume it if needed.
                followLoopSettledRef.current = true;
            } else if (framesStable < SETTLE_FRAMES || liveStableFrames < SETTLE_FRAMES) {
                rafId = requestAnimationFrame(tick);
            } else {
                followLoopSettledRef.current = true;
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
        // Deps: `activeCardId` re-arms on focus changes (the chase's main
        // re-glide trigger); `items` is read via `itemsRef` (re-arming on every
        // keystroke would defeat the settle-stop); `wakeTick` (trigger-only)
        // restarts after idle wakes. `toolbarWrapperRef`/`velocityRef`/
        // `pinnedRef`/`followLoopSettledRef`/`setPinState` are stable refs + a
        // setter threaded through `params` — listed so
        // react-doctor/exhaustive-deps sees the captures match; they never
        // re-arm the loop. The resting target is deliberately NOT a dep — the
        // rAF tick reads it via `computeRestingTargetYEvent` (an Effect
        // Event), which always sees the latest value without re-subscribing
        // the loop.
    }, [isMobile, activeCardId, isDragging, pinState, wakeTick, canvasBodyRef, cardWrapperMapRef, titleCardRef, toolbarWrapperRef, velocityRef, pinnedRef, followLoopSettledRef, setPinState]);
}

/**
 * Scroll pinning — geometry evaluator. WINDOW-SCROLL mode: the page owns the
 * scroll, so the visible box is derived from insets (`topInset` = sticky
 * header height, `bottomInset` = bottom-bar height) instead of a scroller
 * element's rect. See the component docstring for the full model. Owns the
 * activation-detection ref (`prevActiveCardIdRef`) and the inset-change ref
 * (`prevBottomInsetRef`); the activation re-arm runs one RELAXED evaluation
 * (zero hysteresis margin + zero velocity lead) so the toolbar reacts to a
 * card click in the same frame.
 */
function useToolbarPinEvaluator(params: {
    isMobile: boolean;
    isDragging: boolean;
    activeCardId: string | null;
    pinState: PinState;
    isFocusMode: boolean;
    /**
     * Structural-move / geometry-change wake (the component's `wakeTick`,
     * bumped on `effectiveIndex` slot changes and idle wakes). Re-arms this
     * evaluator so a move/insert/delete that shifts the resting target WITHOUT
     * a scroll event re-runs the pin decision against the NEW footprint. The
     * chase re-arms on the same tick and glides to the shifted resting target;
     * without this re-arm the evaluator keeps sleeping (no scroll/resize/RO
     * fires — card wrappers only MOVE via GSAP `y`), so a move-up that pulls
     * the resting top above the header would let the toolbar glide up PAST the
     * pin line and clip under the header.
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
     * (a Focus Mode toggle at ≤768px flips `bottomInset`). Those must animate
     * the pinned offset instead of re-reading it instantly; every other re-arm
     * keeps the instant `refreshPin`. See the re-arm branch below.
     */
    const prevBottomInsetRef = useRef(bottomInset);

    /**
     * Last `activeCardId` the evaluator ran with — detects ACTIVATION re-arms
     * (a focus change). Those must bypass the scroll-hysteresis band: a
     * deliberate click cannot flip-flop (only scroll stutter can), so the
     * first evaluation after a focus change uses the relaxed gate — zero
     * `PIN_REENTER` margin and zero velocity lead — making the toolbar react
     * to the click in the same frame: unpin onto the newly-activated card the
     * moment its footprint is anywhere fully visible, or flip straight to the
     * correct edge, instead of holding the old pin until the 40px full-fit
     * margin clears.
     */
    const prevActiveCardIdRef = useRef(activeCardId);

    useEffect(() => {
        // Activation detection — synced FIRST, even before the isMobile /
        // isDragging guard (it only touches a ref, no DOM), so the ref never
        // goes stale: every re-arm with a changed `activeCardId` is an
        // activation, and its first evaluation must bypass the hysteresis band
        // (see `relaxed` in `evaluate`) so the toolbar reacts to the click in
        // the same frame instead of holding the old pin.
        const activated = prevActiveCardIdRef.current !== activeCardId;
        prevActiveCardIdRef.current = activeCardId;

        if (isMobile || isDragging) return;

        const wrapper = toolbarWrapperRef.current;
        const laneNode = wrapper?.parentElement;
        const bodyNode = canvasBodyRef?.current;
        if (!wrapper || !laneNode || !bodyNode) return;

        // Cheap sanity guard only — `evaluate()` below no longer reads
        // `targetNode`: the pin footprint is fully state-derived (effectiveIndex
        // + resting-height caches). Keep this as a mount check; do NOT
        // re-introduce a live-rect read here — that is exactly the transient-pin
        // bug this resting-footprint fix removes.
        const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
        const targetNode = activeNode ?? titleCardRef?.current ?? null;
        if (!targetNode) return;

        // Local mirror of `pinState` — dedups DOM work; `setPinState` drives
        // the chase loop's freeze/resume. Initialized FROM the React state
        // (not a hardcoded 'anchored'): a re-run while pinned (activeCardId
        // swap, drag release, Focus Mode toggle) must start in sync with the
        // DOM/state, or the first `applyPin('anchored')` would early-return
        // and leave the toolbar stuck fixed with the chase suspended.
        let current: 'anchored' | 'top' | 'bottom' = pinState;

        // Shared pin geometry writer — positions the fixed toolbar in the
        // lane's column against the scroller's visible box, honoring the
        // current pin side. Used on pin AND on re-reads (see `refreshPin`).
        // Declared BEFORE `applyPin` (which calls it) so there is no
        // declaration-order hazard — this exact trap bit us once (calling a
        // later `const` before its declaration throws a TDZ ReferenceError).
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
        // is centered (`maxWidth: 832` + `justify-content: center`), the
        // sidebar rail width animates on Focus Mode toggles (GSAP tween —
        // changes the canvas width, resizing the grid/title), and the recovery
        // banner can mount above. Two signals re-read the pinned geometry: a
        // ResizeObserver on the wrapper/grid/title (fires when their boxes
        // change size) and the window `resize` listener (fires on ANY viewport
        // size change — a width resize recenters the maxWidth-capped body and
        // slides the lane WITHOUT resizing any observed box, which RO misses
        // entirely, and a height resize changes the viewport box the pin math
        // is framed against; see the listener's comment below). There is no
        // scroller element anymore — the window owns the scroll.
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
                // viewport-relative) position into the chase loop's coordinate
                // space (`wrapperRect.top - bodyRect.top`, both viewport-
                // relative and therefore scroll-invariant). NO scrollTop term
                // — the wrapper's transform y already is that delta, so adding
                // the scroll would shift the toolbar by the scroll amount on
                // every unpin.
                //
                // The intermediate set (land exactly where it visually was) is
                // what makes the position-mode switch seamless — there is NO
                // explicit tween back to the card here: `docY` IS the current
                // visual position (a `gsap.to(wrapper, { y: docY })` would be
                // a no-op), and the actual return glide is owned by the chase
                // — `setPinState('anchored')` re-arms effect 1, which reads
                // the live card position and tweens to it. Opacity is reset in
                // case an entrance tween was cut short (pin → immediate
                // unpin).
                const wrapperRect = wrapper.getBoundingClientRect();
                const bodyRect = bodyNode.getBoundingClientRect();
                const docY = Math.max(0, wrapperRect.top - bodyRect.top);
                gsap.killTweensOf(wrapper, 'y,opacity');
                gsap.set(wrapper, { clearProps: 'position,top,bottom,left,zIndex' });
                gsap.set(wrapper, { y: docY, opacity: 1 });
                return;
            }

            // Pin: take the toolbar out of the lane's layout flow and fix it
            // to the viewport's VISIBLE box — `topInset` (below the sticky
            // header) down to `innerHeight − bottomInset` (above the bottom
            // bar). The offsets are viewport-relative but inset-aware:
            // `top: topInset + 16` parks the toolbar just below the header,
            // never over it. `left` is captured explicitly because
            // `position: fixed` would otherwise snap to the viewport's left
            // edge.
            // Continuous lock, not a materialize: with the edge-touch trigger
            // the toolbar is ALREADY on-screen at the edge when this fires
            // (its leading edge is at the visible edge), so we capture where
            // it visually is right now, switch to `position: fixed`, and ease
            // the transform from there to the pinned position. No fade — the
            // toolbar never left the screen, so fading would flash it. The
            // settle runs on TRANSFORM y, NOT top/bottom: `refreshPin`
            // re-writes top/bottom/left on the `pinState` re-arm ~1 frame
            // later, which would cut a top/bottom tween to a single frame,
            // while y is untouched by the geometry writer. Direction falls
            // out naturally: top-pin settles DOWN into the edge (fromY < 0),
            // bottom-pin settles UP (fromY > 0).
            const effectiveBottom = window.innerHeight - bottomInset;
            const pinnedTop =
                next === 'top'
                    ? topInset + PIN_MARGIN
                    : effectiveBottom - PIN_MARGIN - wrapper.offsetHeight;
            // `fromY = wrapper.top − pinnedTop` is normally −16..+16 (the
            // toolbar is at the edge when edge-touch fires), but a pin SIDE
            // flip (top ↔ bottom) starts a FULL viewport span away — up to
            // ~±590px on a 900px viewport.
            //
            // The clamp is a TOP-EDGE guarantee ONLY: when pinning to the
            // TOP, a violent fling can pin while the toolbar is already
            // clipped ABOVE the header, and an unclamped glide would slide it
            // DOWN through the header region. Clamping to −PIN_MARGIN starts
            // the glide exactly at the edge instead — the toolbar was
            // off-screen anyway, so the "jump" is invisible and it simply
            // re-enters at the pinned spot. Bottom pins are NEVER clamped: a
            // bottom settle only travels within the visible box (it can never
            // cross the header), and clamping a bottom-pin's large negative
            // fromY (a top→bottom flip) was exactly what teleported the
            // toolbar — the geometry writer did all the travel instantly and
            // the 0.25s settle animated a 16px sliver.
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
                    // reads as a deliberate glide (capped at the reflow
                    // duration — the app's "big motion" constant) while
                    // same-edge edge-touch pins keep the quick 0.25s lock.
                    duration: Math.min(
                        REFLOW_DURATION,
                        Math.max(PIN_IN_DURATION, Math.abs(fromY) / PIN_GLIDE_SPEED),
                    ),
                    ease: 'power2.out',
                    overwrite: 'auto',
                },
            );
        };

        // One evaluation per frame, deduped via rAF (scroll events fire
        // faster than frames; the evaluator reads ~4 rects — trivial).
        let rafId: number | null = null;

        const evaluate = (relaxed = false) => {
            rafId = null;

            const bodyRect = bodyNode.getBoundingClientRect();
            const toolbarHeight = wrapper.offsetHeight; // layout height — unaffected by position mode
            // Degenerate frame (transient unmount/reflow): skip the decision
            // and re-evaluate next frame instead of emitting a spurious pin.
            if (!toolbarHeight) return;

            // The toolbar's HYPOTHETICAL viewport rect if it were anchored to
            // the card right now — the card's RESTING doc-space top (the same
            // constant the chase's one-glide targets: collapsed-height cache +
            // callout estimate, clamped like the chase) re-derived into
            // viewport space via bodyRect.top (which carries the scroll term),
            // plus the toolbar's own height. NOT the card's LIVE mid-animation
            // rect: during a focus change the new card's live top is still
            // BELOW its resting top (the old active card above is collapsing),
            // so the live footprint's bottom edge transiently pokes past the
            // effective bottom → a spurious pin→unpin round trip (the snap).
            // The resting footprint is constant during transitions → the pin
            // decision is stable. NOT the wrapper's actual rect, which is
            // meaningless while pinned.
            const restingTop = computeRestingTargetYRef.current();
            const hypoTop = bodyRect.top + restingTop;
            const hypoBottom = hypoTop + toolbarHeight;

            // EFFECTIVE bottom: the viewport's visible bottom minus any app
            // chrome overlapping it (the shell's bottom nav at ≤768px, via the
            // `bottomInset` prop). A bottom-pinned toolbar must stay ABOVE the
            // bar — the footprint crosses the effective bottom (not the raw
            // viewport bottom) before pinning, and the unpin gate requires a
            // full fit above it.
            const effectiveBottom = window.innerHeight - bottomInset;

            let next: 'anchored' | 'top' | 'bottom' = current;

            // Velocity-anticipation lead: pin while the footprint is still this
            // close to the edge when the user is scrolling fast, so the toolbar
            // locks in as the card's edge arrives — `fromY` stays small and the
            // pinned toolbar never pops above the scroller's top edge (no brief
            // header overlap on a fling). Capped below PIN_REENTER so the pin
            // threshold can never cross the unpin gate (hysteresis holds even at
            // extreme velocity). At rest this reduces to plain edge-touch.
            // Velocity-anticipation lead — zeroed on the relaxed activation
            // evaluation: a click has no scroll to anticipate, so the decision
            // is pure geometry at click time.
            const lead = relaxed
                ? 0
                : Math.min(
                      readVelocity(velocityRef.current, performance.now()) * VELOCITY_LEAD_S,
                      MAX_PIN_LEAD,
                  );
            // Unpin gate margin — 0 on the relaxed activation evaluation: the
            // card the user just clicked may sit inside the scroll-hysteresis
            // band (fully visible but not 40px clear of an edge). The band
            // only guards scroll flip-flop, and a deliberate click cannot
            // flip-flop — the click is allowed straight through to
            // full-fit-without-margin. Scroll/resize ticks keep the 40px
            // margin.
            const gate = relaxed ? 0 : PIN_REENTER;
            if (hypoTop < topInset + lead) {
                // EDGE-TOUCH trigger: the footprint's leading (top) edge has
                // reached the sticky header's bottom edge (`topInset`) — the
                // toolbar is about to scroll under the header. Pin NOW so it
                // is ALREADY pinned the moment it would start to clip: a true
                // sticky toolbar.
                next = 'top';
            } else if (hypoBottom > effectiveBottom - lead) {
                // Mirror case at the effective bottom edge (scrolling toward
                // the end of the quiz — the footprint's bottom edge touches
                // the bottom of the usable area, i.e. just above the app's
                // bottom nav).
                next = 'bottom';
            } else if (
                hypoTop >= topInset + gate &&
                hypoBottom <= effectiveBottom - gate
            ) {
                // Fully clear of BOTH edges by the dead-band margin — safe to
                // unpin. Symmetric full-fit: unpin only when the toolbar's own
                // footprint fits entirely (with margin), never while it would
                // still be clipped at either edge. The pin line (at the visible
                // edge) and this gate (PIN_REENTER inside) are the hysteresis
                // gap preventing anchored ↔ pinned flip-flop.
                next = 'anchored';
            }

            // Delegate the transition entirely to `applyPin` — it owns the
            // guard (`next === current` early return) AND the state writes
            // (`current`/`pinnedRef`/`setPinState`) before the DOM work. The
            // caller must NOT pre-set `current` here: doing so would make
            // applyPin's own guard see `next === current` and return without
            // ever pinning (the wrapper would stay absolute while `pinState`
            // claims it is pinned).
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
        // Activation re-arm: run the relaxed evaluation ONCE, synchronously,
        // so the toolbar reacts to the click in the same frame — a pinned
        // toolbar must not stay glued to its old edge while the card it was
        // just asked to follow sits elsewhere on screen (this effect's own
        // cleanup already cancelled the previous run's pending rAF). Every
        // later scroll/resize evaluation keeps the strict hysteresis gate.
        if (activated) {
            evaluate(true);
        }
        // Scroll-speed tracker — feeds the chase's velocity-scaled follow
        // duration (effect 1) and this evaluator's pin-anticipation lead.
        // EMA-smoothed and timestamped so `readVelocity` decays it smoothly
        // once the content coasts to a stop. `velocityRef` persists across
        // effect re-arms (pinState flips, activeCardId changes) — the locals
        // below reset, but the last timestamped sample survives in the ref and
        // decays via `readVelocity` rather than being lost.
        // Window-scroll mode: the page owns the scroll, so velocity comes from
        // `window.scrollY` and the listener lives on the window.
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

        // The pinned geometry can ALSO go stale with NO observed box change:
        // a window width resize recenters the maxWidth-capped canvas body,
        // sliding the lane horizontally — but ResizeObserver only reports
        // SIZE changes, and in the capped range the scroller's own box keeps
        // its size, so the pinBoxObserver below never fires for it (verified
        // in a headless probe: zero RO callbacks during a width resize while
        // the lane moved ~110px and the pinned toolbar stayed behind). The
        // window `resize` event is the reliable signal for exactly this case
        // — re-read the pinned geometry directly from LIVE rects. `resize`
        // dispatches post-layout, so `refreshPin` always sees the new lane
        // position (no stale frame).
        const handleWindowResize = () => {
            refreshPin();
            scheduleEvaluate();
        };
        window.addEventListener('resize', handleWindowResize);

        // Re-read the pinned geometry when the wrapper/grid/title boxes change
        // (rail animation frames, banner mount, toolbar size) and re-evaluate
        // the pin decision when the layout's size changes (the grid/meta card
        // growing moves the card's doc-space top without any scroll event).
        // There is no scroller element to observe — the visible box is
        // inset-derived, and the window `resize` listener covers viewport
        // size changes.
        const pinBoxObserver = new ResizeObserver(() => {
            refreshPin();
            scheduleEvaluate();
        });
        pinBoxObserver.observe(wrapper);
        if (gridRef?.current) pinBoxObserver.observe(gridRef.current);
        if (titleCardRef?.current) pinBoxObserver.observe(titleCardRef.current);

        // Re-armed while already pinned (e.g. Focus Mode toggle re-runs this
        // effect via `isFocusMode`) — re-apply the pinned geometry so `left`
        // follows the shifted lane immediately.
        //
        // EXCEPTION — inset-driven re-arms (a Focus Mode toggle at ≤768px
        // changed `bottomInset`): `refreshPin` is instant (`gsap.set`) and
        // would snap a bottom-pinned toolbar from 104px to 16px in one frame.
        // Animate it instead — 0.35s power2.out, matching the rail/pill motion
        // language. The slide runs on TRANSFORM y, NOT `bottom`: animating
        // `bottom` is a per-frame layout cost at the exact moment the toggle
        // is busiest (document relayout + double render), which reads as
        // stutter. The pin settle already avoids top/bottom for the same
        // reason — `refreshPin` re-writes top/bottom/left on the `pinState`
        // re-arm ~1 frame later, which would cut a bottom tween to a single
        // frame, while transform y is untouched by the geometry writer (and
        // `willChange: 'transform'` promotes the wrapper, so the slide is
        // compositor-only). One layout write to the new `bottom`, then ease
        // the transform from the toolbar's current visual spot to 0 —
        // direction falls out naturally (negative sliding down, positive up),
        // and rapid double-toggles continue from wherever the toolbar
        // actually is. Only tween when the footprint still violates the NEW
        // effective bottom (the toolbar will stay pinned); if the freed space
        // revealed the card, do nothing and let the evaluator un-pin next
        // frame — the unpin handoff starts from the toolbar's current visual
        // spot, so the glide back to the card is seamless. The
        // `willStayPinned` check mirrors the evaluator's unpin gate EXACTLY
        // (both edges + margin) — identical math, so the two can only
        // disagree if the geometry changes between this frame and the
        // evaluator's next tick (a scroll in the same frame), which
        // self-corrects on the next scroll. (A one-sided check could leave the
        // toolbar stuck at the OLD offset if the gate's top edge failed.)
        const insetChanged = prevBottomInsetRef.current !== bottomInset;
        if (current === 'bottom' && insetChanged) {
            const newEffectiveBottom = window.innerHeight - bottomInset;
            const bodyRect = bodyNode.getBoundingClientRect();
            const toolbarH = wrapper.offsetHeight;
            const hypoTop = bodyRect.top + computeRestingTargetYRef.current();
            const hypoBottom = hypoTop + toolbarH;
            // Degenerate frame (transient unmount/reflow): default to tweening
            // — the evaluator skips its own decision that frame anyway.
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
                // Read the LIVE visual top AFTER killing any in-flight tween —
                // `killTweensOf` freezes the transform in place, so the rect
                // still includes the current y offset and the fromTo starts
                // from exactly where the toolbar visually is.
                gsap.killTweensOf(wrapper, 'y,bottom');
                // Steady-state invariant: the old pinned top is
                // `innerHeight − oldInset − PIN_MARGIN − h`, so `fromY` reduces
                // to exactly `bottomInset − oldInset` (±88) — Focus ON = −88
                // (slides down into the freed space), Focus OFF = +88 (slides
                // back up under the returning nav).
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
        // Mode toggles (GSAP, 0.35s) WITHOUT a window `resize` event, and while
        // the canvas body is width-capped (maxWidth 832) its observed boxes
        // (wrapper/grid/title) only SHIFT — a ResizeObserver fires on size, not
        // position — so neither refresh signal fires and the pinned toolbar's
        // `left` would stay at the pre-animation position (it visually escapes
        // the lane). On every re-arm while pinned, sample the lane's rect per
        // frame until it holds still (the rail settle) or the budget expires,
        // re-applying the pinned geometry each frame so `left` chases the lane
        // to its resting spot. Re-arms while pinned are rare (focus change,
        // Focus Mode toggle, pin/unpin) and the poll exits after 3 stable
        // frames when nothing is moving.
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
        // Deps: `isFocusMode` is trigger-only — never read in the body; it
        // re-arms this effect so `refreshPin` re-reads the lane's `left` after
        // the rail-width animation shifts it. `topInset` re-arms on sticky-
        // header height changes (breakpoints), re-deriving the visible box.
        // `wakeTick` (trigger-only) re-arms on structural moves and idle wakes:
        // the resting target shifted without any scroll/resize/RO signal, so
        // the pin decision must be re-run against the new footprint — a move-up
        // can pull the resting top above the pin line, and without the re-arm
        // the toolbar glides up past the header and clips (see the param doc).
        // `toolbarWrapperRef`/`pinnedRef`/`computeRestingTargetYRef`/
        // `velocityRef`/`setPinState` are stable refs + a setter threaded
        // through `params` — listed for react-doctor/exhaustive-deps; they
        // never re-arm the evaluator.
    }, [isMobile, isDragging, activeCardId, pinState, isFocusMode, wakeTick, bottomInset, topInset, canvasBodyRef, cardWrapperMapRef, titleCardRef, gridRef, toolbarWrapperRef, pinnedRef, computeRestingTargetYRef, velocityRef, setPinState]);
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
 * - Scroll pinning: while the chase is anchored the toolbar scrolls with the
 *   content; the toolbar pins to the top or bottom edge (`position: fixed`,
 *   same lane column) the moment its hypothetical footprint's LEADING edge
 *   leaves the VIEWPORT's visible box (top: `hypoTop < topInset`, the sticky
 *   header's height; bottom: `hypoBottom > effectiveBottom = innerHeight −
 *   bottomInset`, the viewport bottom minus the shell's bottom-bar inset) —
 *   so it is ALREADY pinned the instant it would start scrolling out of
 *   view, a true sticky toolbar.
 *   Geometry-based (which side the footprint is leaving); scroll speed feeds
 *   only a short anticipation lead at the pin edges (≤ MAX_PIN_LEAD). Unpinning requires the footprint to fully clear both
 *   visible edges by the 40px `PIN_REENTER` margin (symmetric full-fit), and
 *   that gap between the pin line (the edge) and the gate (40px inside) is
 *   the hysteresis preventing anchored ↔ pinned flip-flop. While pinned the
 *   chase is suspended; unpinning converts the pinned viewport position back
 *   into the scroller's content space so the chase glides from where the
 *   toolbar visually was — no jump. Pinning is a continuous lock (0.25s ease
 *   from the toolbar's current on-screen position into the pinned position —
 *   no fade, since the edge-touch trigger pins while it is already at the
 *   edge); the unpin handoff is seamless and the return glide is owned by the
 *   chase re-arm.
 *   Trigger: NOT "does the card intersect" (an IntersectionObserver on the
 *   card fires too late — the toolbar is far shorter than an expanded card,
 *   so it is fully clipped while the card still "intersects" — and can't
 *   express a hypothetical rect for the wrapper, whose real rect is
 *   meaningless while `position: fixed`). Instead a scroll/rAF evaluator
 *   computes the toolbar's hypothetical anchored rect (the card's doc-space
 *   top + the toolbar's own height) against the viewport's visible box
 *   (below the sticky header, above the bottom bar). WINDOW-SCROLL mode: the
 *   page owns the scroll — events come from `window`, `scrollTop` is
 *   `window.scrollY`, and the visible box is `topInset` → `innerHeight −
 *   bottomInset` rather than a scroller element's rect.
 * - Mobile (<640px): clears inline transforms and any pin styles so the fixed
 *   viewport bottom bar operates cleanly.
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
     * by the pinning evaluator (outside React's commit) so the chase rAF can
     * never tween the `position: fixed` wrapper in the one-frame gap between
     * the evaluator's DOM writes and the `pinState` commit.
     */
    const pinnedRef = useRef(false);
    /**
     * Scroll-pin state — while not 'anchored' the follow loop is suspended
     * (the toolbar is pinned to a viewport edge, outside the chase's
     * coordinate space).
     */
    const [pinState, setPinState] = useState<PinState>('anchored');

    // The sidebar rail animates its width on Focus Mode toggles (GSAP tween,
    // no `resize` event), shifting the lane horizontally while the toolbar may
    // be pinned — the pinning evaluator re-arms on this and re-reads `left`.
    const { isFocusMode } = useFocusMode();

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

    // Structural-move wake: a toolbar Move up/down (or an insert/delete above
    // the active card) shifts the active card's SLOT without changing
    // `activeCardId`, and the card wrappers only MOVE (GSAP `y` — a
    // ResizeObserver fires on size, not position), so neither the follow-loop
    // re-arm (`activeCardId` dep) nor the idle wake observers restart the
    // chase — the toolbar would stay frozen at the old spot. Bump the wake
    // tick directly whenever the effective slot changes; the re-armed loop
    // then issues its one-glide to the new resting target in parallel with
    // the card glide. The PIN EVALUATOR re-arms on the same tick: a move-up
    // can pull the resting footprint's top above the header, and with no
    // scroll/resize/RO signal the evaluator would keep sleeping while the
    // chase glides up — leaving the toolbar clipped under the header instead
    // of pinned at the edge.
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

    // Scroll pinning — geometry evaluator. Owns the activation-detection ref
    // (`prevActiveCardIdRef`) and the inset-change ref (`prevBottomInsetRef`);
    // a card-click re-arm runs one RELAXED evaluation so the toolbar reacts in
    // the same frame. See the hook doc for the full model.
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
                            // into view when it lands off-screen (the toolbar
                            // stays pinned while its target card scrolls away).
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
                            // the vacated slot (or the title card when the
                            // quiz becomes empty) — scroll THAT into view,
                            // still gated on being off-screen: deleting the
                            // only card usually leaves the meta card already
                            // visible, so a plain scroll would nudge the
                            // viewport for no reason.
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
