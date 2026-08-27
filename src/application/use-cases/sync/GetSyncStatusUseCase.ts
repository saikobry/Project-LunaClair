import type { SyncStatusStore, SyncStatus } from '../../sync/SyncStatusStore';

export type SyncStatusResult = SyncStatus;

/**
 * Retrieves the current synchronization status, pending mutation count, and checkpoint cursors.
 */
export class GetSyncStatusUseCase {
  private readonly statusStore: SyncStatusStore;

  constructor(statusStore: SyncStatusStore) {
    this.statusStore = statusStore;
  }

  execute(): SyncStatusResult {
    return this.statusStore.getState();
  }
}
