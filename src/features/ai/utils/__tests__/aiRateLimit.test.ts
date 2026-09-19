import { describe, expect, it } from 'vitest';
import {
  AI_RATE_LIMIT_FALLBACK_SECONDS,
  formatCooldownNotice,
  resolveCooldownSeconds,
} from '../aiRateLimit';

describe('resolveCooldownSeconds', () => {
  it('honours the wait the provider named', () => {
    expect(resolveCooldownSeconds(7)).toBe(7);
  });

  it('rounds a fractional wait up, so the cooldown never ends early', () => {
    expect(resolveCooldownSeconds(1.2)).toBe(2);
  });

  it('falls back when the provider named no wait', () => {
    expect(resolveCooldownSeconds(undefined)).toBe(AI_RATE_LIMIT_FALLBACK_SECONDS);
    expect(resolveCooldownSeconds(Number.NaN)).toBe(AI_RATE_LIMIT_FALLBACK_SECONDS);
    expect(resolveCooldownSeconds(0)).toBe(AI_RATE_LIMIT_FALLBACK_SECONDS);
    expect(resolveCooldownSeconds(-5)).toBe(AI_RATE_LIMIT_FALLBACK_SECONDS);
  });

  it('bounds an implausibly long wait instead of holding the composer hostage', () => {
    expect(resolveCooldownSeconds(3_600)).toBe(120);
  });
});

describe('formatCooldownNotice', () => {
  it('names the wait so the user knows when to try again', () => {
    expect(formatCooldownNotice(8)).toContain('8s');
  });
});
