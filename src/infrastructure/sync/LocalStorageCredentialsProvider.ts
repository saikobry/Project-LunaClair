import type { SessionCredentials } from '../../domain/sync/models/sync.types';
import type { SessionCredentialsProvider } from '../../domain/sync/services/SessionCredentialsProvider';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { getOrCreateDeviceId } from './deviceId';

const CREDENTIALS_KEY = STORAGE_KEYS.sync?.sessionCredentials ?? 'lunaclair.session_credentials';

/**
 * LocalStorage-backed implementation of `SessionCredentialsProvider`.
 * Manages active user authentication credentials and defaults to a guest identity.
 */
export class LocalStorageCredentialsProvider implements SessionCredentialsProvider {
  async getCredentials(): Promise<SessionCredentials | null> {
    if (typeof localStorage === 'undefined') {
      return {
        userId: 'user_default',
        deviceId: getOrCreateDeviceId(),
        token: 'guest_token',
      };
    }

    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionCredentials;
        if (
          parsed &&
          typeof parsed.userId === 'string' &&
          typeof parsed.deviceId === 'string' &&
          typeof parsed.token === 'string'
        ) {
          return parsed;
        }
      } catch {
        // Fall through on JSON parse errors to guest identity
      }
    }

    return {
      userId: 'user_default',
      deviceId: getOrCreateDeviceId(),
      token: 'guest_token',
    };
  }

  async setCredentials(credentials: SessionCredentials): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    }
  }

  async clearCredentials(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CREDENTIALS_KEY);
    }
  }
}

export const localStorageCredentialsProvider = new LocalStorageCredentialsProvider();
