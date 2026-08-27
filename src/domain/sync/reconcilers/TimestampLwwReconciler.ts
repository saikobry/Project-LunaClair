import { compareLwwTimestamps } from '../sync.versioning';

export interface LwwTimestampEntity {
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type LwwReconcileResult<T> =
  | {
      kind: 'apply';
      payload: T;
    }
  | {
      kind: 'ignore';
      reason: string;
    };

/**
 * Pure domain reconciler for timestamp-based Last-Write-Wins (LWW) entities (Model A: highlights, drawings).
 *
 * Compares timestamps using `compareLwwTimestamps`:
 * - If local record does not exist -> applies remote entity.
 * - If remote timestamp > local timestamp -> applies remote entity (including tombstones).
 * - If local timestamp > remote timestamp -> ignores remote entity.
 * - If timestamps are equal -> ignores remote entity (local is already up to date).
 */
export function reconcileTimestampLww<T extends LwwTimestampEntity>(
  local: T | null | undefined,
  remote: T
): LwwReconcileResult<T> {
  if (!local) {
    return {
      kind: 'apply',
      payload: remote,
    };
  }

  const localTime = local.deletedAt ?? local.updatedAt ?? local.createdAt;
  const remoteTime = remote.deletedAt ?? remote.updatedAt ?? remote.createdAt;

  const cmp = compareLwwTimestamps(localTime, remoteTime);

  if (cmp === 'remote_wins') {
    return {
      kind: 'apply',
      payload: remote,
    };
  }

  return {
    kind: 'ignore',
    reason: cmp === 'equal' ? 'Timestamps are identical' : 'Local record is more recent',
  };
}
