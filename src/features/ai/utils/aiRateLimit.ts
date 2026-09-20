import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

/**
 * Cooldown policy for provider rate limits.
 *
 * One model the app offers (MAX) is free but shared: the provider allows roughly 5 prompts per
 * minute **per IP**, and every user of a deployment shares one Worker egress IP. A refusal is
 * therefore a normal outcome of a busy moment rather than a fault, and the useful response is to
 * stop spending requests until the provider's own window has passed.
 *
 * The provider states the wait when it can ("Try again in 7s."); when it does not, this fallback is
 * used. It is a courtesy, not a quota: the server remains the only authority, and a request sent
 * early simply fails again.
 *
 * The cooldown is **persisted** (`STORAGE_KEYS.ai.rateLimitUntil`), because the wait describes the
 * provider's window rather than this tab: a reload that forgot it would spend the very next request
 * on another refusal. It survives backgrounding for the same reason — the deadline is absolute.
 */

/** Used when the provider refused without naming a wait. */
export const AI_RATE_LIMIT_FALLBACK_SECONDS = 10;

/**
 * No wait is allowed to exceed this. A provider could in principle answer with an hour; holding the
 * composer hostage for an hour would be worse than letting the user try and be refused.
 */
const MAX_COOLDOWN_SECONDS = 120;

/** Resolves the wait to honor, in whole seconds, bounded to something a person can wait out. */
export function resolveCooldownSeconds(retryAfterSeconds?: number): number {
  if (retryAfterSeconds === undefined || !Number.isFinite(retryAfterSeconds)) {
    return AI_RATE_LIMIT_FALLBACK_SECONDS;
  }
  const rounded = Math.ceil(retryAfterSeconds);
  if (rounded <= 0) return AI_RATE_LIMIT_FALLBACK_SECONDS;
  return Math.min(rounded, MAX_COOLDOWN_SECONDS);
}

/**
 * Resolves the deadline a new refusal should establish, given one that may already be running.
 *
 * **Monotonic**: a refusal may only ever push the deadline out, never pull it in. The cooldown is
 * started after an `await`, so a slower older turn can report its rate limit *after* a newer one
 * already did — and "try again in 3s" from a stale response must not cancel the "try again in 45s"
 * a fresher one just established. The provider's window is shared, so the longest wait anyone has
 * been told is the honest one. An expired `current` is ignored rather than merged, so a lapsed
 * wait cannot inflate the next one.
 */
export function mergeCooldownDeadline(
  current: number | null,
  requested: number,
  now: number = Date.now(),
): number {
  if (current === null || current <= now) return requested;
  return Math.max(current, requested);
}

/** Short, honest label for the picker while a cooldown runs. */
export function formatCooldownNotice(seconds: number): string {
  return `Shared capacity is busy — try again in ${seconds}s`;
}

/**
 * Whole seconds left before `until`, never negative.
 *
 * Counted from an absolute deadline rather than decremented per tick, so a backgrounded tab that
 * misses ticks resumes at the right remaining time instead of drifting.
 */
export function secondsUntilDeadline(until: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / 1_000));
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

/**
 * Reads the persisted cooldown deadline, or `null` when there is none left to honor.
 *
 * The deadline is **absolute epoch ms**, which is what makes it survive a reload and a backgrounded
 * tab alike. Two values are refused as not-ours rather than honored: one in the past (nothing to
 * wait for) and one further out than the policy maximum (only a stale or hand-edited value could be
 * that far away, and honoring it would hold the composer hostage for hours). A refused entry is
 * removed so it cannot be reconsidered on the next mount.
 */
export function readCooldownDeadline(
  storage?: Storage,
  now: number = Date.now(),
): number | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(STORAGE_KEYS.ai.rateLimitUntil);
    if (!raw) return null;

    const until = Number.parseInt(raw, 10);
    const maxUntil = now + MAX_COOLDOWN_SECONDS * 1_000;
    if (!Number.isFinite(until) || until <= now || until > maxUntil) {
      target.removeItem(STORAGE_KEYS.ai.rateLimitUntil);
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

/** Persists (or clears, with `null`) the deadline a cooldown is counting down to. */
export function writeCooldownDeadline(until: number | null, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    if (until === null) target.removeItem(STORAGE_KEYS.ai.rateLimitUntil);
    else target.setItem(STORAGE_KEYS.ai.rateLimitUntil, String(until));
  } catch {
    // A full or unavailable storage costs the cooldown's survival across reloads, nothing more.
  }
}
