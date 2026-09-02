import { describe, it, expect } from 'vitest';
import {
  isValidSyncCursor,
  assertCursorMonotonic,
  advanceSyncCursor,
} from '../syncCursor';
import { InvalidSyncCursorError } from '../../errors/SyncErrors';

describe('Sync Cursor Validation & Monotonicity', () => {
  describe('isValidSyncCursor', () => {
    it('returns true for non-negative integers', () => {
      expect(isValidSyncCursor(0)).toBe(true);
      expect(isValidSyncCursor(1)).toBe(true);
      expect(isValidSyncCursor(42)).toBe(true);
      expect(isValidSyncCursor(1_000_000)).toBe(true);
    });

    it('returns false for negative numbers', () => {
      expect(isValidSyncCursor(-1)).toBe(false);
      expect(isValidSyncCursor(-100)).toBe(false);
    });

    it('returns false for floats and non-integers', () => {
      expect(isValidSyncCursor(1.5)).toBe(false);
      expect(isValidSyncCursor(0.001)).toBe(false);
    });

    it('returns false for NaN, Infinity, and non-number types', () => {
      expect(isValidSyncCursor(NaN)).toBe(false);
      expect(isValidSyncCursor(Infinity)).toBe(false);
      expect(isValidSyncCursor(-Infinity)).toBe(false);
      expect(isValidSyncCursor('0')).toBe(false);
      expect(isValidSyncCursor(null)).toBe(false);
      expect(isValidSyncCursor(undefined)).toBe(false);
      expect(isValidSyncCursor({})).toBe(false);
    });
  });

  describe('assertCursorMonotonic', () => {
    it('succeeds when next cursor is strictly greater than previous', () => {
      expect(() => assertCursorMonotonic(0, 1)).not.toThrow();
      expect(() => assertCursorMonotonic(10, 20)).not.toThrow();
    });

    it('succeeds when next cursor is equal to previous (idempotent)', () => {
      expect(() => assertCursorMonotonic(5, 5)).not.toThrow();
      expect(() => assertCursorMonotonic(0, 0)).not.toThrow();
    });

    it('throws InvalidSyncCursorError when next cursor is less than previous', () => {
      expect(() => assertCursorMonotonic(10, 9)).toThrow(InvalidSyncCursorError);
      expect(() => assertCursorMonotonic(1, 0)).toThrow(InvalidSyncCursorError);
    });

    it('throws InvalidSyncCursorError when previous or next is not a valid cursor', () => {
      expect(() => assertCursorMonotonic(-1, 5)).toThrow(InvalidSyncCursorError);
      expect(() => assertCursorMonotonic(5, -1)).toThrow(InvalidSyncCursorError);
      expect(() => assertCursorMonotonic(null as unknown as number, 5)).toThrow(InvalidSyncCursorError);
      expect(() => assertCursorMonotonic(5, '6' as unknown as number)).toThrow(InvalidSyncCursorError);
    });
  });

  describe('advanceSyncCursor', () => {
    it('returns next cursor when valid and monotonic', () => {
      expect(advanceSyncCursor(0, 1)).toBe(1);
      expect(advanceSyncCursor(10, 15)).toBe(15);
      expect(advanceSyncCursor(20, 20)).toBe(20);
    });

    it('throws InvalidSyncCursorError on non-monotonic or invalid advance', () => {
      expect(() => advanceSyncCursor(5, 3)).toThrow(InvalidSyncCursorError);
      expect(() => advanceSyncCursor(5, -1)).toThrow(InvalidSyncCursorError);
    });
  });
});
