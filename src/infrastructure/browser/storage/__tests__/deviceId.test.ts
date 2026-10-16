import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOrCreateDeviceId } from '../deviceId';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';

describe('deviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getOrCreateDeviceId', () => {
    it('generates and persists a stable UUID in localStorage', () => {
      const id1 = getOrCreateDeviceId();
      expect(id1).toBeDefined();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);

      // Value is persisted under STORAGE_KEYS.sync.deviceId
      expect(localStorage.getItem(STORAGE_KEYS.sync.deviceId)).toBe(id1);

      // Calling again returns the exact same deviceId
      const id2 = getOrCreateDeviceId();
      expect(id2).toBe(id1);
    });

    it('returns existing deviceId if already present in localStorage', () => {
      localStorage.setItem(STORAGE_KEYS.sync.deviceId, 'custom-device-macbook-pro');
      const id = getOrCreateDeviceId();
      expect(id).toBe('custom-device-macbook-pro');
    });
  });
});
