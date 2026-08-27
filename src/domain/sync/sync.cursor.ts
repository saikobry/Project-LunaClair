import { InvalidSyncCursorError } from './sync.errors';
import type { SyncCursor } from './sync.types';

/**
 * Validates that a cursor is a non-negative integer.
 */
export function isValidSyncCursor(cursor: unknown): cursor is SyncCursor {
  return typeof cursor === 'number' && Number.isInteger(cursor) && cursor >= 0;
}

/**
 * Asserts that the next cursor is greater than or equal to the previous cursor.
 * Throws InvalidSyncCursorError if either cursor is invalid or if next < previous.
 */
export function assertCursorMonotonic(previous: SyncCursor, next: SyncCursor): void {
  if (!isValidSyncCursor(previous)) {
    throw new InvalidSyncCursorError(`Previous sync cursor is invalid: ${String(previous)}`, previous);
  }
  if (!isValidSyncCursor(next)) {
    throw new InvalidSyncCursorError(`Next sync cursor is invalid: ${String(next)}`, next);
  }
  if (next < previous) {
    throw new InvalidSyncCursorError(
      `Non-monotonic sync cursor advance detected: next cursor (${next}) cannot be less than previous cursor (${previous})`,
      next
    );
  }
}

/**
 * Validates and advances the sync cursor monotonically.
 */
export function advanceSyncCursor(current: SyncCursor, next: SyncCursor): SyncCursor {
  assertCursorMonotonic(current, next);
  return next;
}
