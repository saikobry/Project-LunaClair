import type { QuizSessionSyncPayload } from '../sync.entities';

export type QuizSessionReconcileResult =
  | {
      kind: 'apply';
      payload: QuizSessionSyncPayload;
    }
  | {
      kind: 'ignore';
      reason: string;
    };

/**
 * Pure domain reconciler for historical assessment sessions (Model B - Append-only).
 *
 * Rules:
 * 1. If local session does not exist -> applies remote session record.
 * 2. If local session already exists -> ignores remote change (historical records are immutable).
 */
export function reconcileQuizSession(
  local: QuizSessionSyncPayload | { id: string } | null | undefined,
  remote: QuizSessionSyncPayload
): QuizSessionReconcileResult {
  if (!local) {
    return {
      kind: 'apply',
      payload: remote,
    };
  }

  return {
    kind: 'ignore',
    reason: 'Quiz session already exists locally (immutable append-only record)',
  };
}
