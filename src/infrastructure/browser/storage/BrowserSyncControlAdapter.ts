import type { SyncControlPort } from '../../../domain/sync/services/SyncControlPort';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

/**
 * Concrete browser adapter implementing SyncControlPort via localStorage.
 * Scoped strictly per owner identity to prevent cross-account pause leakage.
 * Maintains an in-memory fallback set so storage failures/refusals preserve pause state.
 */
export class BrowserSyncControlAdapter implements SyncControlPort {
  private readonly memoryPaused = new Set<string>();

  isPaused(ownerSub?: string): boolean {
    if (ownerSub) {
      if (this.memoryPaused.has(ownerSub)) {
        return true;
      }
      try {
        if (typeof localStorage === 'undefined') {
          return false;
        }
        const specific = localStorage.getItem(`${STORAGE_KEYS.sync.paused}.${ownerSub}`);
        return specific === 'true';
      } catch {
        return false;
      }
    }
    if (this.memoryPaused.has('__all__')) {
      return true;
    }
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      const prefix = `${STORAGE_KEYS.sync.paused}.`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && localStorage.getItem(key) === 'true') {
          return true;
        }
      }
    } catch {
      // Storage access error
    }
    return false;
  }

  pause(ownerSub?: string): void {
    if (ownerSub) {
      this.memoryPaused.add(ownerSub);
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(`${STORAGE_KEYS.sync.paused}.${ownerSub}`, 'true');
      } catch {
        // LocalStorage access failure / QuotaExceededError is non-fatal; memory fallback preserves pause
      }
      return;
    }
    this.memoryPaused.add('__all__');
  }

  resume(ownerSub?: string): void {
    if (ownerSub) {
      this.memoryPaused.delete(ownerSub);
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(`${STORAGE_KEYS.sync.paused}.${ownerSub}`);
      } catch {
        // Ignore storage errors
      }
      return;
    }
    this.memoryPaused.delete('__all__');
  }
}

export const browserSyncControlAdapter = new BrowserSyncControlAdapter();
