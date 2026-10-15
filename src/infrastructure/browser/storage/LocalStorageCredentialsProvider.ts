import type { SessionCredentials } from '../../../domain/sync/models/sync.types';
import type { SessionCredentialsProvider } from '../../../domain/sync/services/SessionCredentialsProvider';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

const CREDENTIALS_KEY = STORAGE_KEYS.sync?.sessionCredentials ?? 'lunaclair.session_credentials';

/**
 * LocalStorage-backed implementation of `SessionCredentialsProvider`.
 * Manages active user authentication credentials. Returns null when unauthenticated.
 */
export class LocalStorageCredentialsProvider implements SessionCredentialsProvider {
  async getCredentials(): Promise<SessionCredentials | null> {
    if (typeof localStorage === 'undefined') {
      return null;
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
        // Corrupted credentials entry
      }
    }

    return null;
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
