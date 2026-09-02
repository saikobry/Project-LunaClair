import { describe, it, expect, vi } from 'vitest';
import { SyncStatusStore } from '../SyncStatusStore';
import type { SyncQueueRepository } from '../../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../../domain/sync/repositories/SyncStateRepository';
import type { SyncState } from '../../../domain/sync/models/sync.types';

describe('SyncStatusStore', () => {
  it('manages observable state and notifies subscribers on setState', () => {
    const store = new SyncStatusStore();
    expect(store.getState()).toEqual({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: undefined,
      lastError: undefined,
      lastServerCursor: undefined,
    });

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ state: 'syncing', pendingCount: 5 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      state: 'syncing',
      pendingCount: 5,
      lastSyncedAt: undefined,
      lastError: undefined,
      lastServerCursor: undefined,
    });

    unsubscribe();

    store.setState({ state: 'idle' });
    expect(listener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  it('rehydrates projection from syncState and syncQueue repositories', async () => {
    const store = new SyncStatusStore();

    const mockSyncState: SyncState = {
      key: 'usr-1:dev-1',
      userId: 'usr-1',
      deviceId: 'dev-1',
      lastServerCursor: 42,
      lastSyncedAt: '2026-08-27T12:00:00.000Z',
    };

    const mockStateRepo: SyncStateRepository = {
      getSyncState: vi.fn().mockResolvedValue(mockSyncState),
      saveSyncState: vi.fn().mockResolvedValue(undefined),
    };

    const mockQueueRepo: SyncQueueRepository = {
      countPending: vi.fn().mockResolvedValue(7),
      enqueue: vi.fn().mockResolvedValue(undefined),
      peekPending: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    await store.rehydrateFromStorage(mockStateRepo, mockQueueRepo, 'usr-1:dev-1');

    expect(store.getState()).toEqual({
      state: 'idle',
      pendingCount: 7,
      lastSyncedAt: '2026-08-27T12:00:00.000Z',
      lastError: undefined,
      lastServerCursor: 42,
    });
  });
});
