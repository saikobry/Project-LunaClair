import type { EntityVersion } from '../models/sync.types';

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
  const localIso = localUpdatedAt.includes('_') ? localUpdatedAt.split('_')[0]! : localUpdatedAt;
  const remoteIso = remoteUpdatedAt.includes('_') ? remoteUpdatedAt.split('_')[0]! : remoteUpdatedAt;
  const localTime = new Date(localIso).getTime();
  const remoteTime = new Date(remoteIso).getTime();

  if (isNaN(localTime) || isNaN(remoteTime)) {
    if (localUpdatedAt > remoteUpdatedAt) return 'local_wins';
    if (remoteUpdatedAt > localUpdatedAt) return 'remote_wins';
    return 'equal';
  }

  if (localTime > remoteTime) return 'local_wins';
  if (remoteTime > localTime) return 'remote_wins';
  if (localUpdatedAt > remoteUpdatedAt) return 'local_wins';
  if (remoteUpdatedAt > localUpdatedAt) return 'remote_wins';
  return 'equal';
}
