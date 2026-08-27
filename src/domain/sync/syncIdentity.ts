/**
 * Creates a unique composite lookup key for tracking local synchronization state.
 */
export function createSyncStateKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`;
}

/**
 * Validates that both userId and deviceId are non-empty strings.
 */
export function isValidSyncIdentity(userId: string, deviceId: string): boolean {
  if (typeof userId !== 'string' || typeof deviceId !== 'string') {
    return false;
  }
  return userId.trim().length > 0 && deviceId.trim().length > 0;
}
