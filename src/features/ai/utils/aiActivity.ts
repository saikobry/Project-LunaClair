/**
 * Cadence and thresholds for the in-flight assistant activity indicator.
 *
 * The indicator must answer "is it working, or is it stuck?" without the user
 * having to guess. It rotates generic labels while the request is young, then
 * escalates to an explicit stall warning at {@link AI_ACTIVITY_STALL_MS}, and
 * the request is abandoned once it has produced no token at all for
 * {@link AI_FIRST_TOKEN_TIMEOUT_MS}.
 */
export const AI_ACTIVITY_TICK_MS = 500;
export const AI_ACTIVITY_STALL_MS = 10_000;
export const AI_ACTIVITY_ROTATION_MS = 2_500;
export const AI_FIRST_TOKEN_TIMEOUT_MS = 30_000;

const ROTATING_LABELS = [
  'Thinking…',
  'Cooking…',
  'Digging through your material…',
  'Weighing the details…',
];

export interface AiActivityState {
  label: string;
  elapsedMs: number;
  /** True once the request has run long enough to warrant a "still working" escalation. */
  isStalled: boolean;
}

/**
 * Maps elapsed wait time to the label shown while the assistant has produced no
 * text yet. Pure and deterministic so the escalation ladder is unit-testable
 * without timers.
 */
export function resolveAiActivity(elapsedMs: number): AiActivityState {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const isStalled = elapsed >= AI_ACTIVITY_STALL_MS;

  const label = isStalled
    ? `Still working… ${Math.floor(elapsed / 1000)}s`
    : ROTATING_LABELS[Math.floor(elapsed / AI_ACTIVITY_ROTATION_MS) % ROTATING_LABELS.length];

  return { label, elapsedMs: elapsed, isStalled };
}
