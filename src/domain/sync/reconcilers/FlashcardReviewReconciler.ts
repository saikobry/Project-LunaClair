import type { FlashcardReviewSyncPayload } from '../sync.entities';
import { compareFlashcardReviews } from '../sync.versioning';

export type FlashcardReconcileResult =
  | {
      kind: 'apply';
      payload: FlashcardReviewSyncPayload;
    }
  | {
      kind: 'ignore';
      reason: string;
    };

/**
 * Pure domain reconciler for flashcard review scheduling state (Model A).
 *
 * Uses deterministic comparator `compareFlashcardReviews`:
 * 1. Recency of `lastReviewedAt`.
 * 2. Reviewed vs unreviewed presence.
 * 3. Repetitions tie-breaker.
 * 4. Review count tie-breaker.
 */
export function reconcileFlashcardReview(
  local: FlashcardReviewSyncPayload | null | undefined,
  remote: FlashcardReviewSyncPayload
): FlashcardReconcileResult {
  if (!local) {
    return {
      kind: 'apply',
      payload: remote,
    };
  }

  const cmp = compareFlashcardReviews(local, remote);

  if (cmp === 'remote_wins') {
    return {
      kind: 'apply',
      payload: remote,
    };
  }

  return {
    kind: 'ignore',
    reason: cmp === 'equal' ? 'Flashcard review states are identical' : 'Local flashcard review is newer',
  };
}
