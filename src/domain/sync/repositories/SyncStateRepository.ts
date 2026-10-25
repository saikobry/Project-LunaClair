import type { SyncState } from '../models/sync.types';

export interface SyncStateRepository {
  /**
   * Retrieves the sync state checkpoint for the specified identity key (`userId:deviceId`).
   */
  getSyncState(key: string): Promise<SyncState | null>;

  /**
   * Saves or updates the sync state checkpoint.
   */
  saveSyncState(state: SyncState): Promise<void>;

  /**
   * Atomically updates the sync state checkpoint within a transaction.
   */
  updateSyncState?(
    key: string,
    updater: (current: SyncState | null) => SyncState
  ): Promise<SyncState>;
}
