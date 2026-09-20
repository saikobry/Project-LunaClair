import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_RATE_LIMIT_FALLBACK_SECONDS,
  formatCooldownNotice,
  mergeCooldownDeadline,
  readCooldownDeadline,
  resolveCooldownSeconds,
  secondsUntilDeadline,
  writeCooldownDeadline,
} from '../aiRateLimit';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';

/** Minimal in-memory Storage so the test never depends on jsdom's localStorage contents. */
function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

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

describe('mergeCooldownDeadline', () => {
  const now = 1_700_000_000_000;

  it('establishes the requested deadline when none is running', () => {
    expect(mergeCooldownDeadline(null, now + 10_000, now)).toBe(now + 10_000);
  });

  it('lets a stale refusal push the deadline out but never pull it in', () => {
    const running = now + 45_000;

    // A slower, older turn reporting "3s" after a fresher one reported 45s must not shorten it.
    expect(mergeCooldownDeadline(running, now + 3_000, now)).toBe(running);
    expect(mergeCooldownDeadline(running, now + 60_000, now)).toBe(now + 60_000);
  });

  it('ignores a lapsed deadline, so an expired wait cannot inflate the next one', () => {
    expect(mergeCooldownDeadline(now - 1, now + 5_000, now)).toBe(now + 5_000);
  });
});

describe('formatCooldownNotice', () => {
  it('names the wait so the user knows when to try again', () => {
    expect(formatCooldownNotice(8)).toContain('8s');
  });
});

describe('secondsUntilDeadline', () => {
  it('rounds up, so a countdown never ends before the wait does', () => {
    expect(secondsUntilDeadline(10_000, 8_200)).toBe(2);
  });

  it('never reports negative seconds', () => {
    expect(secondsUntilDeadline(1_000, 5_000)).toBe(0);
  });
});

describe('cooldown persistence', () => {
  let storage: Storage;
  const now = 1_700_000_000_000;

  beforeEach(() => {
    storage = createStorage();
  });

  it('survives a reload by storing an absolute deadline', () => {
    writeCooldownDeadline(now + 30_000, storage);

    expect(readCooldownDeadline(storage, now)).toBe(now + 30_000);
  });

  it('reports nothing once the deadline has passed, and forgets it', () => {
    writeCooldownDeadline(now - 1, storage);

    expect(readCooldownDeadline(storage, now)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.ai.rateLimitUntil)).toBeNull();
  });

  it('refuses a deadline beyond the policy maximum rather than holding the composer hostage', () => {
    writeCooldownDeadline(now + 6 * 60 * 60 * 1_000, storage);

    // Only a stale or hand-edited value could be hours away; honoring it would block sending.
    expect(readCooldownDeadline(storage, now)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.ai.rateLimitUntil)).toBeNull();
  });

  it('refuses an unparseable value', () => {
    storage.setItem(STORAGE_KEYS.ai.rateLimitUntil, 'soon');

    expect(readCooldownDeadline(storage, now)).toBeNull();
  });

  it('clears the deadline when the cooldown is written as null', () => {
    writeCooldownDeadline(now + 30_000, storage);
    writeCooldownDeadline(null, storage);

    expect(readCooldownDeadline(storage, now)).toBeNull();
  });

  it('reports nothing without a storage, and survives one that refuses to write', () => {
    const refusing = createStorage();
    refusing.getItem = () => {
      throw new Error('denied');
    };
    refusing.setItem = () => {
      throw new Error('quota exceeded');
    };

    expect(() => writeCooldownDeadline(now + 1_000, refusing)).not.toThrow();
    expect(readCooldownDeadline(refusing, now)).toBeNull();
  });
});
