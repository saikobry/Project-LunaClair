import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

const DEVICE_ID_KEY = STORAGE_KEYS.sync?.deviceId ?? 'lunaclair.device_id';

/**
 * Retrieves the persisted device identifier or generates and stores a new stable UUID.
 */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }

    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      localStorage.setItem(DEVICE_ID_KEY, newId);
    } catch {
      // Ignore storage quota or access errors in restricted sandbox
    }

    return newId;
  }

  return 'device_default';
}
