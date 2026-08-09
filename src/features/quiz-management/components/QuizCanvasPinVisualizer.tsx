import { useEffect, useRef, type RefObject } from 'react';

/**
 * Debug-only overlay that visualizes the toolbar lane's scroll-pinning
 * geometry live. Enable by adding `?pinviz=1` to the quiz-canvas builder URL
 * (e.g. `/materials/cell-structure/builder/quiz-cell-master-50?pinviz=1`).
 *
 * It paints, each frame, the exact inputs the pinning evaluator reads:
 *
 * - The viewport's visible-box edges (window-scroll mode — `topInset` = the
 *   sticky header's height, `bottomInset` = the bottom bar's) — the two PIN
 *   thresholds (EDGE-TOUCH trigger). PIN-TOP fires the instant the footprint's
 *   TOP edge reaches the visible top plus a velocity anticipation lead
 *   (`hypoTop < topInset + lead`); PIN-BOTTOM fires when its BOTTOM edge
 *   reaches the EFFECTIVE visible bottom (`hypoBottom > effectiveBottom`,
 *   where `effectiveBottom = innerHeight − bottomInset` — the viewport bottom
 *   minus the shell's bottom nav, so a bottom-pinned toolbar stays above the
 *   bar). The toolbar is ALREADY pinned the moment it would start scrolling
 *   out of view — a true sticky toolbar.
 * - The 40px `PIN_REENTER` full-fit gates (dashed) — the symmetric gate an
 *   UNPIN must clear on BOTH edges (top edge ≥ this +40, bottom edge ≤
 *   effectiveBottom −40). The gap between the pin line (at the edge) and
 *   these gates is the hysteresis against flip-flop.
 * - A translucent "bottom bar inset" zone between the effective bottom and
 *   the raw viewport bottom — the app chrome a bottom-pinned toolbar must
 *   stay above.
 * - The toolbar's HYPOTHETICAL anchored footprint — the RESTING footprint,
 *   at the card's doc-space top if the toolbar were tracking it (clamped like
 *   the chase clamps `liveY`). Color-coded by the live decision: red = would
 *   pin this frame, amber = hysteresis band — the footprint is partially
 *   visible but not clear of the dead-band, so the CURRENT state is HELD
 *   (pinned stays pinned until full fit; anchored stays anchored), green =
 *   fully fits. The `state` line is the actual DOM truth; the `decision` line
 *   is what a FRESH evaluation would decide — the two can differ while the
 *   hysteresis band is holding a state, which is by design, not a bug.
 * - A chip with the live state machine (actual DOM position vs React
 *   `pinState` — a mismatch is exactly the "pinned in state, not in the DOM"
 *   bug class), plus scrollTop / hypo rect / toolbar height.
 * - An event log tagging the exact scrollTop where each PIN / UNPIN fired,
 *   with a brief flash on the freshest entry.
 *
 * The overlay is a raw DOM layer appended to `document.body`
 * (`pointer-events: none`, z-index 9999) driven by a rAF loop — the same
 * imperative pattern as the chase itself, so it never triggers React
 * re-renders and never interferes with the app. Zero runtime cost when the
 * flag is absent.
 *
 * IMPORTANT — the flag is captured at MODULE SCOPE, not at render: AppShell's
 * URL-sync effect rebuilds the URL from the parsed route (`routeToUrl` drops
 * unknown query params), so `pinviz` is stripped from `location.search` by
 * the time this component first renders. Module evaluation happens at app
 * load — before any React render — so it reliably sees the original URL. This
 * only holds because the quiz-management feature is statically imported (no
 * `React.lazy` anywhere in `src/app`); keep it that way.
 */
export interface QuizCanvasPinVisualizerProps {
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    activeCardId: string | null;
    toolbarWrapperRef?: RefObject<HTMLDivElement | null>;
    pinState: 'anchored' | 'top' | 'bottom';
    /**
     * Height (px) of app chrome (the shell's mobile bottom nav) overlapping
     * the viewport's bottom edge — mirrors the lane's `bottomInset` prop; the
     * effective bottom is `innerHeight − bottomInset`.
     */
    bottomInset?: number;
    /**
     * Height (px) of the sticky builder header — mirrors the lane's
     * `topInset` prop; the visible box is `topInset` → `innerHeight −
     * bottomInset` (window-scroll mode — no scroller element).
     */
    topInset?: number;
    /**
     * Shared scroll-speed sample (px/s + timestamp) written by the lane's
     * evaluator scroll listener — mirrors the lane's velocity-aware pin lead.
     */
    velocityRef?: RefObject<{ v: number; at: number }>;
    /**
     * Latest resting-target computation from the lane — the evaluator's pin
     * footprint source. The visualizer mirrors the RESTING footprint (not the
     * live rect) so the chip's decision always matches the app's stable
     * pin/unpin decisions during layout transitions.
     */
    computeRestingTopRef?: RefObject<() => number>;
}

/** Mirrors the lane's PIN_REENTER dead-band — keep in sync if it changes. */
const PIN_REENTER = 40;
/** Mirror the lane's velocity-lead tuning — keep in sync if it changes. */
const VELOCITY_LEAD_S = 0.02;
const MAX_PIN_LEAD = 32;

/** Decaying scroll speed from a lane-written sample (τ ≈ 80ms). */
const readVelocity = (sample: { v: number; at: number } | null, now: number): number =>
    sample ? sample.v * Math.exp(-(now - sample.at) / 80) : 0;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const PINVIZ_ENABLED =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pinviz');

type PinDecision = 'top' | 'bottom' | 'fit' | 'deadband';
type VisualState = 'anchored' | 'top' | 'bottom';

const decisionLabel = (d: Exclude<PinDecision, 'deadband'>): string =>
    d === 'top' ? 'would PIN ↑ (footprint top < visibleTop)'
    : d === 'bottom' ? 'would PIN ↓ (footprint bottom > effective bottom)'
    : 'fully fits (both edges + margin)';

const stateColor = (s: VisualState): string =>
    s === 'top' ? '#ff8fa3' : s === 'bottom' ? '#ffb27a' : '#8fffb0';

export function QuizCanvasPinVisualizer({
    canvasBodyRef,
    cardWrapperMapRef,
    titleCardRef,
    activeCardId,
    toolbarWrapperRef,
    pinState,
    bottomInset = 0,
    topInset = 0,
    velocityRef,
    computeRestingTopRef,
}: QuizCanvasPinVisualizerProps) {
    // Latest values for the rAF loop WITHOUT re-arming it — re-arming would
    // rebuild the overlay and wipe the event log on every pin/unpin.
    const pinStateRef = useRef(pinState);
    useEffect(() => {
        pinStateRef.current = pinState;
    });
    const activeCardIdRef = useRef(activeCardId);
    useEffect(() => {
        activeCardIdRef.current = activeCardId;
    });
    const bottomInsetRef = useRef(bottomInset);
    useEffect(() => {
        bottomInsetRef.current = bottomInset;
    });
    const topInsetRef = useRef(topInset);
    useEffect(() => {
        topInsetRef.current = topInset;
    });

    useEffect(() => {
        if (!PINVIZ_ENABLED) return;
        // WINDOW-SCROLL mode: there is no scroller element — the visible box
        // is `topInset` → `innerHeight − bottomInset` and scrollTop is
        // `window.scrollY` (mirrors the lane's evaluator).
        const bodyNode = canvasBodyRef?.current;
        const wrapper = toolbarWrapperRef?.current;
        if (!bodyNode || !wrapper) return;

        // ---- Overlay DOM (raw layer, outside React) ----
        const overlay = document.createElement('div');
        overlay.style.cssText =
            `position:fixed;inset:0;pointer-events:none;z-index:9999;` +
            `font-family:${MONO};font-size:11px;`;

        const mk = (): HTMLDivElement => {
            const el = document.createElement('div');
            overlay.appendChild(el);
            return el;
        };
        const topEdge = mk();
        const topBand = mk();
        const bottomEdge = mk();
        const bottomBand = mk();
        const bottomBar = mk();
        const footprint = mk();
        const chip = mk();
        const logEl = mk();

        document.body.appendChild(overlay);

        // ---- Log state ----
        const logLines: { text: string; at: number }[] = [];
        const MAX_LOG = 8;
        let lastVisual: VisualState = 'anchored';
        let flashSide: VisualState | null = null;
        let flashUntil = 0;

        const pushLog = (text: string) => {
            logLines.push({ text, at: performance.now() });
            if (logLines.length > MAX_LOG) logLines.shift();
        };

        // ---- Per-frame paint ----
        let rafId = 0;
        const tick = () => {
            rafId = requestAnimationFrame(tick);
            const now = performance.now();

            const bodyRect = bodyNode.getBoundingClientRect();
            // The viewport's visible box (window-scroll mode): below the
            // sticky header (`topInset`), above the app chrome (`bottomInset`).
            const visibleTop = topInsetRef.current;
            const effectiveBottom = window.innerHeight - bottomInsetRef.current;

            // Scroll speed + pin-anticipation lead — mirrors the lane's
            // evaluator (readVelocity decay + VELOCITY_LEAD_S / MAX_PIN_LEAD).
            const vel = readVelocity(velocityRef?.current ?? null, now);
            const pinLead = Math.min(vel * VELOCITY_LEAD_S, MAX_PIN_LEAD);
            const activeCardId = activeCardIdRef.current;
            const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
            const targetNode = activeNode ?? titleCardRef?.current ?? null;

            let hypoTop = Number.NaN;
            let hypoBottom = Number.NaN;
            let toolbarH = 0;
            let decision: PinDecision = 'deadband';

            if (targetNode) {
                const targetRect = targetNode.getBoundingClientRect();
                toolbarH = wrapper.offsetHeight;
                hypoTop =
                    bodyRect.top +
                    (computeRestingTopRef?.current
                        ? computeRestingTopRef.current()
                        : Math.max(0, targetRect.top - bodyRect.top));
                hypoBottom = hypoTop + toolbarH;
                if (hypoTop < visibleTop + pinLead) {
                    decision = 'top';
                } else if (hypoBottom > effectiveBottom - pinLead) {
                    decision = 'bottom';
                } else if (
                    hypoTop >= visibleTop + PIN_REENTER &&
                    hypoBottom <= effectiveBottom - PIN_REENTER
                ) {
                    decision = 'fit';
                }
            }

            // Ground truth of what the app ACTUALLY did, from the wrapper's
            // position — not from React state. The SIDE is read from the
            // INLINE style, not computed: Chrome resolves the computed
            // opposite edge of a fixed element with `top` + `height` set (a
            // top-pin's `bottom: auto` comes back as its used value, e.g.
            // `513px` = viewport − top − height), which would mislabel every
            // top-pin as a bottom-pin. The inline string is what
            // `setPinGeometry` actually wrote.
            const pos = getComputedStyle(wrapper).position;
            let actual: VisualState = 'anchored';
            if (pos === 'fixed') {
                actual = wrapper.style.bottom && wrapper.style.bottom !== 'auto' ? 'bottom' : 'top';
            }
            if (actual !== lastVisual) {
                const st = Math.round(window.scrollY);
                if (actual === 'anchored') {
                    pushLog(`UNPIN → anchored @ scrollTop ${st}`);
                } else {
                    pushLog(`PIN → ${actual.toUpperCase()} @ scrollTop ${st}`);
                }
                flashSide = actual;
                flashUntil = now + 900;
                lastVisual = actual;
            }
            const edgeFlash = (side: VisualState) => flashSide === side && now < flashUntil;

            // The dead-band decision needs the CURRENT state to describe what
            // is being held: `decision` is a fresh hypothetical (what the
            // evaluator would decide from scratch this frame), while the state
            // is sticky through the hysteresis band — so `hysteresis — holds
            // PINNED ↑ until full fit` explains the pinned-but-not-decision
            // case the user hit.
            const describeDecision = (d: PinDecision): string => {
                // `deadband` is fully handled here (state-aware); `decisionLabel`
                // only covers the three real decisions.
                if (d === 'deadband') {
                    return actual === 'anchored'
                        ? `hysteresis — still anchored (remnant > ${PIN_REENTER}px)`
                        : `hysteresis — holds PINNED ${actual.toUpperCase()} until full fit`;
                }
                return decisionLabel(d);
            };

            // ---- Threshold lines ----
            const paintEdge = (el: HTMLDivElement, top: number, label: string, active: boolean, flash: boolean, labelAbove = false) => {
                el.style.cssText =
                    `position:fixed;left:0;right:0;top:${top}px;height:2px;` +
                    `background:${active || flash ? '#ff3b5c' : 'rgba(255,255,255,0.32)'};` +
                    (flash ? 'box-shadow:0 0 14px 2px rgba(255,59,92,0.85);' : '') +
                    `transition:background-color 100ms linear;`;
                el.innerHTML =
                    `<span style="position:relative;top:${labelAbove ? -18 : 3}px;left:10px;display:inline-block;` +
                    `background:${active || flash ? '#ff3b5c' : 'rgba(20,22,30,0.9)'};color:#fff;` +
                    `padding:0 7px;border-radius:3px;font-weight:700;line-height:16px;">${label}</span>`;
            };
            const paintBand = (el: HTMLDivElement, top: number, label: string, labelAbove = false) => {
                el.style.cssText =
                    `position:fixed;left:0;right:0;top:${top}px;height:0;` +
                    `border-top:2px dashed rgba(251,191,36,0.75);`;
                el.innerHTML =
                    `<span style="position:relative;top:${labelAbove ? -18 : 3}px;left:10px;display:inline-block;` +
                    `background:rgba(20,22,30,0.9);color:#fbbf24;padding:0 7px;border-radius:3px;` +
                    `font-weight:700;line-height:16px;">${label}</span>`;
            };

            // The PIN thresholds sit ON the visible edges — the toolbar pins
            // the moment the footprint's leading edge touches the edge
            // (sticky: already pinned as it starts to leave). The bottom PIN
            // line sits on the EFFECTIVE bottom (above the bottom bar). The
            // dashed 40px lines are the symmetric full-fit UNPIN gates.
            paintEdge(topEdge, visibleTop, 'PIN-TOP ▸ footprint top < this (below sticky header)', decision === 'top', edgeFlash('top'));
            // The effective bottom may sit at the viewport bottom (no bar) —
            // drawn 2px inside and labeled above so it never renders off-screen.
            paintEdge(bottomEdge, effectiveBottom - 2, 'PIN-BOTTOM ▸ footprint bottom > this', decision === 'bottom', edgeFlash('bottom'), true);
            paintBand(topBand, visibleTop + PIN_REENTER, `unpin gate: footprint top ≥ this (+${PIN_REENTER})`);
            paintBand(bottomBand, effectiveBottom - PIN_REENTER, `unpin gate: footprint bottom ≤ this (−${PIN_REENTER})`);

            // Translucent zone marking the app chrome (bottom nav) between the
            // effective bottom and the scroller's raw bottom — a bottom-pinned
            // toolbar never enters this region.
            const inset = bottomInsetRef.current;
            if (inset > 0) {
                bottomBar.style.cssText =
                    `position:fixed;left:0;right:0;` +
                    `top:${effectiveBottom}px;height:${Math.max(0, window.innerHeight - effectiveBottom)}px;` +
                    `background:repeating-linear-gradient(45deg,rgba(96,165,250,0.12),rgba(96,165,250,0.12) 8px,rgba(96,165,250,0.05) 8px,rgba(96,165,250,0.05) 16px);` +
                    `border-top:1px solid rgba(96,165,250,0.55);`;
                bottomBar.innerHTML =
                    `<span style="position:absolute;top:4px;right:8px;background:rgba(30,41,59,0.95);color:#93c5fd;` +
                    `padding:0 7px;border-radius:3px;font-weight:700;line-height:16px;white-space:nowrap;">` +
                    `app bottom bar inset (${Math.round(inset)}px) — toolbar never pins here</span>`;
            } else {
                bottomBar.style.display = 'none';
            }

            // ---- Hypothetical footprint ----
            if (targetNode && !Number.isNaN(hypoTop) && toolbarH > 0) {
                const color = decision === 'top' || decision === 'bottom' ? '#ff3b5c' : decision === 'fit' ? '#4ade80' : '#fbbf24';
                footprint.style.cssText =
                    `position:fixed;left:${bodyRect.left}px;top:${hypoTop}px;` +
                    `width:${bodyRect.width}px;height:${Math.max(0, hypoBottom - hypoTop)}px;` +
                    `border:2px solid ${color};border-radius:8px;background:${color}26;box-sizing:border-box;`;
                footprint.innerHTML =
                    `<span style="position:absolute;top:-19px;left:8px;background:${color};color:#0b0b10;` +
                    `padding:0 7px;border-radius:3px;font-weight:700;line-height:16px;white-space:nowrap;">` +
                    `hypo footprint (resting ${Math.round(toolbarH)}px) — ${describeDecision(decision)}</span>`;
            } else {
                footprint.style.display = 'none';
            }

            // ---- Chip ----
            const reactState = pinStateRef.current;
            const mismatch = (reactState !== 'anchored') !== (actual !== 'anchored');
            chip.innerHTML = [
                `state: <span style="color:${stateColor(actual)};font-weight:700">${actual === 'anchored' ? 'ANCHORED' : `PINNED ↑ ${actual.toUpperCase()}`}</span>`,
                `react pinState: <span style="color:${mismatch ? '#ff3b5c' : '#aab'};font-weight:700">${reactState}</span>${mismatch ? ' <span style="color:#ff3b5c">⚠ mismatch</span>' : ''}`,
                `scrollTop (window): <b>${Math.round(window.scrollY)}</b>`,
                `toolbar height: ${Math.round(toolbarH)}px`,
                `bottom inset: ${Math.round(bottomInsetRef.current)}px`,
                `hypo: ${Math.round(hypoTop)} → ${Math.round(hypoBottom)}`,
                `scroll vel: ~${Math.round(vel)} px/s (pin lead: ${Math.round(pinLead)}px)`,
                `decision: <span style="color:${decision === 'top' || decision === 'bottom' ? '#ff3b5c' : decision === 'fit' ? '#4ade80' : '#fbbf24'}">${describeDecision(decision)}</span>`,
            ].join('\n');
            chip.style.cssText =
                `position:fixed;top:10px;right:10px;background:rgba(10,12,18,0.88);color:#e8eaf2;` +
                `border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 12px;` +
                `line-height:1.65;white-space:pre;font-family:${MONO};font-size:11px;`;

            // ---- Event log ----
            logEl.innerHTML = logLines.length
                ? logLines
                      .map((l) => {
                          const fresh = now - l.at < 900;
                          const color = l.text.startsWith('PIN') ? '#ff8fa3' : '#8fffb0';
                          return (
                              `<span style="display:block;color:${color};` +
                              `background:${fresh ? 'rgba(255,255,255,0.16)' : 'transparent'};">${l.text}</span>`
                          );
                      })
                      .join('')
                : '<span style="color:#889">— activate a card, then scroll —</span>';
            logEl.style.cssText =
                `position:fixed;left:10px;bottom:10px;background:rgba(10,12,18,0.88);color:#e8eaf2;` +
                `border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 12px;` +
                `line-height:1.7;white-space:pre;font-family:${MONO};font-size:11px;max-width:430px;`;
        };

        rafId = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(rafId);
            overlay.remove();
        };
    }, [canvasBodyRef, cardWrapperMapRef, titleCardRef, toolbarWrapperRef, velocityRef, computeRestingTopRef]);

    return null;
}
