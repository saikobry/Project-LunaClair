import type { FlashcardReviewSyncPayload } from './sync.entities';
import type { EntityVersion } from './sync.types';

/**
 * Checks whether an optimistic concurrency check passes for a document mutation.
 * Returns 'match' when baseVersion === serverVersion, 'conflict' otherwise.
 */
export function evaluateDocumentConcurrency(
  baseVersion: EntityVersion,
  serverVersion: EntityVersion
): 'match' | 'conflict' {
  return baseVersion === serverVersion ? 'match' : 'conflict';
}

/**
 * Calculates the next monotonic version number for an entity.
 */
export function nextEntityVersion(currentVersion?: EntityVersion): EntityVersion {
  return (currentVersion ?? 0) + 1;
}

/**
 * Last-Write-Wins (LWW) timestamp comparator.
 * Compares two ISO-8601 UTC date strings.
 */
export function compareLwwTimestamps(
  localUpdatedAt: string,
  remoteUpdatedAt: string
): 'local_wins' | 'remote_wins' | 'equal' {
  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  if (isNaN(localTime) || isNaN(remoteTime)) {
    if (localUpdatedAt > remoteUpdatedAt) return 'local_wins';
    if (remoteUpdatedAt > localUpdatedAt) return 'remote_wins';
    return 'equal';
  }

  if (localTime > remoteTime) return 'local_wins';
  if (remoteTime > localTime) return 'remote_wins';
  return 'equal';
}

/**
 * Compares two flashcard review states using deterministic LWW semantics:
 * 1. Recency of `lastReviewedAt` timestamp.
 * 2. If only one has `lastReviewedAt`, the reviewed one wins over unreviewed.
 * 3. If neither has `lastReviewedAt` or timestamps are equal, tie-break by higher `repetitions`.
 * 4. If `repetitions` are equal, tie-break by higher `reviewCount`.
 * 5. Returns 'equal' if all criteria are identical.
 */
export function compareFlashcardReviews(
  local: FlashcardReviewSyncPayload,
  remote: FlashcardReviewSyncPayload
): 'local_wins' | 'remote_wins' | 'equal' {
  if (local.lastReviewedAt && remote.lastReviewedAt) {
    const timestampResult = compareLwwTimestamps(local.lastReviewedAt, remote.lastReviewedAt);
    if (timestampResult !== 'equal') {
      return timestampResult;
    }
  } else if (local.lastReviewedAt && !remote.lastReviewedAt) {
    return 'local_wins';
  } else if (!local.lastReviewedAt && remote.lastReviewedAt) {
    return 'remote_wins';
  }

  // Tie-breaker 1: higher repetitions
  if (local.repetitions > remote.repetitions) {
    return 'local_wins';
  }
  if (remote.repetitions > local.repetitions) {
    return 'remote_wins';
  }

  // Tie-breaker 2: higher reviewCount
  if (local.reviewCount > remote.reviewCount) {
    return 'local_wins';
  }
  if (remote.reviewCount > local.reviewCount) {
    return 'remote_wins';
  }

  return 'equal';
}
