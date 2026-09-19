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

/** Short, honest label for the picker while a cooldown runs. */
export function formatCooldownNotice(seconds: number): string {
  return `Shared capacity is busy — try again in ${seconds}s`;
}
