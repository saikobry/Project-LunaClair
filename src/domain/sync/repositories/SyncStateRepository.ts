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
}
