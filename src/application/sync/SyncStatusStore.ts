import type { SyncQueueRepository } from '../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../domain/sync/repositories/SyncStateRepository';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
  lastServerCursor?: number;
}

const DEFAULT_SYNC_STATUS: SyncStatus = {
  state: 'idle',
  pendingCount: 0,
  lastSyncedAt: undefined,
  lastError: undefined,
  lastServerCursor: undefined,
};

/**
 * In-memory observable projection store for cloud sync status and diagnostic metrics.
 * Provides subscription capabilities for UI indicators, badges, and notification toasts.
 */
export class SyncStatusStore {
  private currentStatus: SyncStatus;
  private readonly listeners = new Set<(status: SyncStatus) => void>();

  constructor(initialStatus: Partial<SyncStatus> = {}) {
    this.currentStatus = {
      ...DEFAULT_SYNC_STATUS,
      ...initialStatus,
    };
    this.getState = this.getState.bind(this);
    this.setState = this.setState.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  /**
   * Retrieves the current immutable snapshot of synchronization status.
   */
  getState(): SyncStatus {
    return this.currentStatus;
  }

  /**
   * Updates partial status properties and notifies all registered subscribers.
   */
  setState(partial: Partial<SyncStatus>): void {
    this.currentStatus = {
      ...this.currentStatus,
      ...partial,
    };

    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in SyncStatusStore subscriber callback:', err);
      }
    }
  }

  /**
   * Subscribes a listener to synchronization status changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Rehydrates store state from local storage repositories on application startup or session switch.
   */
  async rehydrateFromStorage(
    syncStateRepo: SyncStateRepository,
    syncQueueRepo: SyncQueueRepository,
    stateKey: string
  ): Promise<void> {
    const [syncState, pendingCount] = await Promise.all([
      syncStateRepo.getSyncState(stateKey),
      syncQueueRepo.countPending(),
    ]);

    const isOffline =
      typeof navigator !== 'undefined' &&
      typeof navigator.onLine === 'boolean' &&
      !navigator.onLine;

    const nextState: SyncStatus['state'] = isOffline
      ? 'offline'
      : this.currentStatus.state === 'offline'
        ? 'idle'
        : this.currentStatus.state;

    this.setState({
      pendingCount,
      lastSyncedAt: syncState?.lastSyncedAt ?? this.currentStatus.lastSyncedAt,
      lastServerCursor: syncState?.lastServerCursor ?? this.currentStatus.lastServerCursor,
      state: nextState,
    });
  }
}

/** Global singleton instance of SyncStatusStore */
export const syncStatusStore = new SyncStatusStore();
