import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageCredentialsProvider } from '../LocalStorageCredentialsProvider';
import { getOrCreateDeviceId } from '../deviceId';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';
import type { SessionCredentials } from '../../../../domain/sync/models/sync.types';

describe('LocalStorageCredentialsProvider & deviceId', () => {
  let provider: LocalStorageCredentialsProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalStorageCredentialsProvider();
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

  describe('LocalStorageCredentialsProvider', () => {
    it('returns default guest identity when no credentials are stored', async () => {
      const credentials = await provider.getCredentials();

      expect(credentials).toEqual({
        userId: 'user_default',
        deviceId: expect.any(String),
        token: 'guest_token',
      });
      expect(credentials?.deviceId).toBe(getOrCreateDeviceId());
    });

    it('persists and retrieves custom session credentials', async () => {
      const customCreds: SessionCredentials = {
        userId: 'user_alice_456',
        deviceId: 'device-iphone-15',
        token: 'auth-jwt-token-xyz',
      };

      await provider.setCredentials(customCreds);

      const storedRaw = localStorage.getItem(STORAGE_KEYS.sync.sessionCredentials);
      expect(storedRaw).toBe(JSON.stringify(customCreds));

      const retrieved = await provider.getCredentials();
      expect(retrieved).toEqual(customCreds);
    });

    it('clears credentials and reverts to guest credentials with stable deviceId', async () => {
      const customCreds: SessionCredentials = {
        userId: 'user_bob_789',
        deviceId: 'device-pixel-8',
        token: 'auth-token-123',
      };

      await provider.setCredentials(customCreds);
      expect(await provider.getCredentials()).toEqual(customCreds);

      await provider.clearCredentials();
      expect(localStorage.getItem(STORAGE_KEYS.sync.sessionCredentials)).toBeNull();

      const afterClear = await provider.getCredentials();
      expect(afterClear?.userId).toBe('user_default');
      expect(afterClear?.token).toBe('guest_token');
    });

    it('gracefully handles corrupted JSON in storage and returns guest credentials', async () => {
      localStorage.setItem(STORAGE_KEYS.sync.sessionCredentials, 'invalid-non-json-string{');

      const creds = await provider.getCredentials();
      expect(creds?.userId).toBe('user_default');
      expect(creds?.token).toBe('guest_token');
      expect(creds?.deviceId).toBe(getOrCreateDeviceId());
    });
  });
});
