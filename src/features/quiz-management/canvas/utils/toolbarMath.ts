// Deterministic error-callout estimate (see `errorCallout` in
// QuizCanvasQuestionCard): 8px top + 8px bottom padding, ~18px per 12px-font
// line, ~55 chars per line at the card's ~660px content width.
export const CALLOUT_PADDING_VERTICAL = 16;
export const CALLOUT_LINE_HEIGHT = 18;
export const CALLOUT_CHARS_PER_LINE = 90; // ~12px font in a ~660px card body

/** Smoothed scroll-speed sample — `v` (px/s) captured at `at` (ms). */
export interface VelocitySample {
    v: number;
    at: number;
}

/**
 * Read a velocity sample with exponential decay toward 0 once scrolling stops
 * (τ ≈ 80ms) — the number fades out smoothly as the content coasts instead of
 * snapping to 0, so keep-pace chasing and the pin lead wind down naturally.
 */
export function readVelocity(sample: VelocitySample, now: number): number {
    return sample.v * Math.exp(-(now - sample.at) / 80);
}

/**
 * Deterministic estimate of a collapsed card's error-callout height, derived
 * from the message count/length in the `errors` prop — never a live DOM
 * measurement. Deliberately approximate: the drift-verify phase of the follow
 * loop is the intended corrector. Do NOT "improve" this into a
 * `getBoundingClientRect` call — that would reintroduce the mid-transition
 * measurement race this resting-position model exists to avoid.
 */
export function estimateCalloutHeight(errors: string[]): number {
    const lines = errors.reduce(
        (total, message) => total + Math.max(1, Math.ceil(message.length / CALLOUT_CHARS_PER_LINE)),
        0,
    );
    return CALLOUT_PADDING_VERTICAL + lines * CALLOUT_LINE_HEIGHT;
}
