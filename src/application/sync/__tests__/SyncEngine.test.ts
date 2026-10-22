import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../../infrastructure/database/schema/schema';
import { LunaClairDatabase } from '../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieSyncReconciler } from '../../../infrastructure/database/sync/DexieSyncReconciler';
import { DexieSyncQueueRepository } from '../../../infrastructure/database/repositories/DexieSyncQueueRepository';
import { DexieSyncStateRepository } from '../../../infrastructure/database/repositories/DexieSyncStateRepository';
import { DexieConflictDraftRepository } from '../../../infrastructure/database/repositories/DexieConflictDraftRepository';
import { SyncEngine } from '../SyncEngine';
import { SyncStatusStore } from '../SyncStatusStore';
import { VaultSyncLockCoordinator } from '../locks/VaultSyncLockCoordinator';
import type { SyncEventSink } from '../SyncEventSink';
import { SyncNetworkError } from '../../../domain/sync/errors/SyncErrors';
import { type SessionCredentials, type SyncPullResponse, type SyncPushResponse, type SyncQueueItem } from '../../../domain/sync/models/sync.types';
import { type SyncTransport } from '../../../domain/sync/services/SyncTransport';

describe('SyncEngine (Orchestrator, Mutex & Convergence Cycle)', () => {
  let testDb: LunaClairDatabase;
  let reconciler: DexieSyncReconciler;
  let queueRepo: DexieSyncQueueRepository;
  let stateRepo: DexieSyncStateRepository;
  let conflictRepo: DexieConflictDraftRepository;
  let statusStore: SyncStatusStore;
  let mockTransport: SyncTransport;

  const credentials: SessionCredentials = {
    userId: 'user-sync-test',
    deviceId: 'device-sync-mac',
    token: 'test-token-jwt',
  };

  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
    testDb = new LunaClairDatabase();
    await testDb.open();

    reconciler = new DexieSyncReconciler(testDb);
    queueRepo = new DexieSyncQueueRepository(testDb);
    stateRepo = new DexieSyncStateRepository(testDb);
    conflictRepo = new DexieConflictDraftRepository(testDb);
    statusStore = new SyncStatusStore();

    mockTransport = {
      pull: vi.fn().mockResolvedValue({
        newCursor: 1,
        hasMore: false,
        changes: [],
      } satisfies SyncPullResponse),
      push: vi.fn().mockResolvedValue({
        accepted: [],
        conflicts: [],
        rejected: [],
      } satisfies SyncPushResponse),
    };
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete(DB_NAME);
    vi.restoreAllMocks();
  });

  it('Test 1: Full 4-step cycle convergence (pull -> reconcile -> push -> pull -> idle)', async () => {
    // 1. Setup pending queue mutation
    const item: SyncQueueItem = {
      id: 'q-item-1',
      clientMutationId: 'mut-1',
      entityType: 'highlight',
      entityId: 'hl-1',
      operation: 'UPSERT',
      clientTimestamp: '2026-08-27T10:00:00.000Z',
      payload: { text: 'Highlighted concept', documentId: 'doc-1', start: 0, end: 10 },
      status: 'pending',
      createdAt: '2026-08-27T10:00:00.000Z',
      retryCount: 0,
    };
    await queueRepo.enqueue(item);

    // 2. Setup mock transport responses for pull 1, push, and pull 2
    const pull1: SyncPullResponse = {
      newCursor: 10,
      hasMore: false,
      changes: [
        {
          sequence: 10,
          entityType: 'document',
          entityId: 'doc-remote-1',
          operation: 'UPSERT',
          version: 1,
          changedAt: '2026-08-27T09:50:00.000Z',
          data: {
            title: 'Remote Doc',
            content: '# Content',
          },
        },
      ],
    };

    const push1: SyncPushResponse = {
      accepted: [{ clientMutationId: 'mut-1', entityId: 'hl-1' }],
      conflicts: [],
      rejected: [],
    };

    const pull2: SyncPullResponse = {
      newCursor: 11,
      hasMore: false,
      changes: [],
    };

    vi.mocked(mockTransport.pull)
      .mockResolvedValueOnce(pull1)
      .mockResolvedValueOnce(pull2);
    vi.mocked(mockTransport.push).mockResolvedValueOnce(push1);

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    // Verify pull was called twice (Step 1 and Step 3)
    expect(mockTransport.pull).toHaveBeenCalledTimes(2);
    expect(mockTransport.pull).toHaveBeenNthCalledWith(1, credentials, 0, 100, expect.any(AbortSignal));
    expect(mockTransport.pull).toHaveBeenNthCalledWith(2, credentials, 10, 100, expect.any(AbortSignal));

    // Verify push was called once (Step 2)
    expect(mockTransport.push).toHaveBeenCalledTimes(1);

    // Verify database state after convergence
    const remoteDoc = await testDb.documentContents.get('doc-remote-1');
    expect(remoteDoc?.title).toBe('Remote Doc');

    // Outbox item deleted on acceptance
    expect(await queueRepo.countPending()).toBe(0);

    // Status store is idle with updated cursor and lastSyncedAt
    const status = statusStore.getState();
    expect(status.state).toBe('idle');
    expect(status.pendingCount).toBe(0);
    expect(status.lastServerCursor).toBe(11);
    expect(status.lastSyncedAt).toBeDefined();
    expect(status.lastError).toBeUndefined();
  });

  it('Test 2: pullUntilCaughtUp paginates through multiple pages until hasMore: false', async () => {
    const page1: SyncPullResponse = {
      newCursor: 100,
      hasMore: true,
      changes: [
        {
          sequence: 50,
          entityType: 'document',
          entityId: 'doc-page-1',
          operation: 'UPSERT',
          version: 1,
          changedAt: '2026-08-27T10:00:00.000Z',
          data: { title: 'Page 1 Doc', content: 'C1' },
        },
      ],
    };

    const page2: SyncPullResponse = {
      newCursor: 200,
      hasMore: false,
      changes: [
        {
          sequence: 150,
          entityType: 'document',
          entityId: 'doc-page-2',
          operation: 'UPSERT',
          version: 1,
          changedAt: '2026-08-27T10:05:00.000Z',
          data: { title: 'Page 2 Doc', content: 'C2' },
        },
      ],
    };

    const emptyPull: SyncPullResponse = {
      newCursor: 200,
      hasMore: false,
      changes: [],
    };

    vi.mocked(mockTransport.pull)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(emptyPull);

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    expect(mockTransport.pull).toHaveBeenCalledTimes(3);
    expect(mockTransport.pull).toHaveBeenNthCalledWith(1, credentials, 0, 100, expect.any(AbortSignal));
    expect(mockTransport.pull).toHaveBeenNthCalledWith(2, credentials, 100, 100, expect.any(AbortSignal));
    expect(mockTransport.pull).toHaveBeenNthCalledWith(3, credentials, 200, 100, expect.any(AbortSignal));

    expect(await testDb.documentContents.get('doc-page-1')).toBeDefined();
    expect(await testDb.documentContents.get('doc-page-2')).toBeDefined();
    expect(statusStore.getState().lastServerCursor).toBe(200);
  });

  it('Test 2b: pullUntilCaughtUp does not clobber fresh transport syncState fields', async () => {
    const page: SyncPullResponse = {
      newCursor: 50,
      hasMore: false,
      changes: [],
    };

    const stateKey = `${credentials.userId}:${credentials.deviceId}`;
    await stateRepo.saveSyncState({
      key: stateKey,
      userId: credentials.userId,
      deviceId: credentials.deviceId,
      lastServerCursor: 0,
      pageToken: 'initial-page-token',
      appliedFileIds: ['file-1'],
    });

    vi.mocked(mockTransport.pull).mockImplementation(async () => {
      // Transport pull updates pageToken and appliedFileIds mid-pull
      await stateRepo.saveSyncState({
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        pageToken: 'updated-page-token-by-pull',
        appliedFileIds: ['file-1', 'file-2'],
      });
      return page;
    });

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    const finalState = await stateRepo.getSyncState(stateKey);
    expect(finalState?.lastServerCursor).toBe(50);
    expect(finalState?.pageToken).toBe('updated-page-token-by-pull');
    expect(finalState?.appliedFileIds).toEqual(['file-1', 'file-2']);
  });

  it('Test 3: pushPendingBatches drains outbox in chunks', async () => {
    // Create 120 pending outbox items
    for (let i = 1; i <= 120; i++) {
      await queueRepo.enqueue({
        id: `q-drain-${i}`,
        clientMutationId: `mut-drain-${i}`,
        entityType: 'highlight',
        entityId: `hl-drain-${i}`,
        operation: 'UPSERT',
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: { text: `Highlight ${i}` },
        status: 'pending',
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        retryCount: 0,
      });
    }

    expect(await queueRepo.countPending()).toBe(120);

    vi.mocked(mockTransport.push).mockImplementation(async (_creds, req) => {
      return {
        accepted: req.mutations.map((m) => ({
          clientMutationId: m.clientMutationId,
          entityId: m.entityId,
        })),
        conflicts: [],
        rejected: [],
      };
    });

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    // 120 items in chunks of 50 -> 3 batches (50, 50, 20)
    expect(mockTransport.push).toHaveBeenCalledTimes(3);
    expect(await queueRepo.countPending()).toBe(0);
    expect(statusStore.getState().pendingCount).toBe(0);
  });

  it('Test 4: Single-flight mutex: multiple concurrent sync() calls merge into 1 cycle + 1 follow-up run', async () => {
    let resolvePull: (value: SyncPullResponse) => void;
    const delayedPullPromise = new Promise<SyncPullResponse>((res) => {
      resolvePull = res;
    });

    vi.mocked(mockTransport.pull).mockImplementationOnce(() => delayedPullPromise);

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    // Call sync 3 times concurrently
    const p1 = engine.sync(credentials);
    const p2 = engine.sync(credentials);
    const p3 = engine.sync(credentials);

    expect(p2).toBe(p1);
    expect(p3).toBe(p1);

    // Resolve the first delayed pull
    resolvePull!({
      newCursor: 1,
      hasMore: false,
      changes: [],
    });

    await p1;

    // Mutex should have executed the initial run + scheduled 1 follow-up run
    // Total pull calls = 1 for cycle 1 + 1 for cycle 2 = 2 pulls (with idle second-pull skip optimization)
    expect(mockTransport.pull).toHaveBeenCalledTimes(2);
  });

  it('Test 5: Offline detection sets status to offline without throwing', async () => {
    const originalNavigator = globalThis.navigator;
    // Mock navigator.onLine = false
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await expect(engine.sync(credentials)).resolves.toBeUndefined();

    expect(mockTransport.pull).not.toHaveBeenCalled();
    expect(mockTransport.push).not.toHaveBeenCalled();
    expect(statusStore.getState().state).toBe('offline');

    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('Test 6: Network error triggers retry/error state and preserves outbox queue items', async () => {
    await queueRepo.enqueue({
      id: 'q-preserve-1',
      clientMutationId: 'mut-preserve-1',
      entityType: 'document',
      entityId: 'doc-preserve-1',
      operation: 'UPSERT',
      clientTimestamp: '2026-08-27T10:00:00.000Z',
      payload: { title: 'Offline doc' },
      status: 'pending',
      createdAt: '2026-08-27T10:00:00.000Z',
      retryCount: 0,
    });

    vi.mocked(mockTransport.pull).mockRejectedValueOnce(
      new SyncNetworkError('Failed to fetch from cloud worker')
    );

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    // State becomes offline because SyncNetworkError is detected
    expect(statusStore.getState().state).toBe('offline');

    // Outbox queue item is preserved and still pending
    const queueItem = await testDb.syncQueue.get('q-preserve-1');
    expect(queueItem).toBeDefined();
    expect(queueItem?.status).toBe('pending');
    expect(await queueRepo.countPending()).toBe(1);
  });

  it('Test 7: Conflict stashing during push updates conflictDrafts and removes item from queue', async () => {
    // 1. Setup local document and outbox mutation with stale baseVersion
    await testDb.documentContents.put({
      documentId: 'doc-conf-test-1',
      title: 'Local Doc',
      content: '# Local Work',
      updatedAt: '2026-08-27T10:00:00.000Z',
    });

    await queueRepo.enqueue({
      id: 'q-conf-1',
      clientMutationId: 'mut-conf-1',
      entityType: 'document',
      entityId: 'doc-conf-test-1',
      operation: 'UPSERT',
      baseVersion: 1,
      clientTimestamp: '2026-08-27T10:00:00.000Z',
      payload: { content: '# Local Work' },
      status: 'pending',
      createdAt: '2026-08-27T10:00:00.000Z',
      retryCount: 0,
    });

    // 2. Transport push returns a conflict
    vi.mocked(mockTransport.push).mockResolvedValueOnce({
      accepted: [],
      conflicts: [
        {
          clientMutationId: 'mut-conf-1',
          entityType: 'document',
          entityId: 'doc-conf-test-1',
          serverVersion: 3,
          serverPayload: {
            title: 'Server Master Doc',
            content: '# Server Authoritative Content v3',
            updatedAt: '2026-08-27T10:05:00.000Z',
          },
        },
      ],
      rejected: [],
    });

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    await engine.sync(credentials);

    // Conflict draft is saved
    const drafts = await conflictRepo.getByDocumentId('doc-conf-test-1');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].baseVersion).toBe(1);
    expect(drafts[0].serverVersion).toBe(3);
    expect(drafts[0].localContent).toBe('# Local Work');
    expect(drafts[0].serverContent).toBe('# Server Authoritative Content v3');

    // Conflicting outbox item is removed from queue
    expect(await queueRepo.countPending()).toBe(0);
    expect(await testDb.syncQueue.get('q-conf-1')).toBeUndefined();

    // Document is updated to canonical server version
    const updatedDoc = await testDb.documentContents.get('doc-conf-test-1');
    expect(updatedDoc?.content).toBe('# Server Authoritative Content v3');
  });

  it('returns retry policy correctly', () => {
    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    expect(engine.getRetryPolicy()).toBeDefined();
    expect(engine.getRetryPolicy().maxRetries).toBe(5);
  });

  it('short-circuits to standby state when unauthenticated or credentials missing, preserving syncQueue', async () => {
    const item: SyncQueueItem = {
      id: 'q-buffered-1',
      clientMutationId: 'mut-buf-1',
      entityType: 'highlight',
      entityId: 'hl-buf-1',
      operation: 'UPSERT',
      clientTimestamp: '2026-08-27T10:00:00.000Z',
      payload: { text: 'Buffered highlight' },
      status: 'pending',
      createdAt: '2026-08-27T10:00:00.000Z',
      retryCount: 0,
    };
    await queueRepo.enqueue(item);

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    // 1. Null credentials
    const resultNull = await engine.sync(null as unknown as SessionCredentials);
    expect(resultNull).toEqual({ status: 'standby' });
    expect(statusStore.getState().state).toBe('standby');
    expect(mockTransport.pull).not.toHaveBeenCalled();
    expect(mockTransport.push).not.toHaveBeenCalled();
    expect(await queueRepo.countPending()).toBe(1);

    // 2. Missing credentials (undefined)
    const resultUndefined = await engine.sync(undefined);
    expect(resultUndefined).toEqual({ status: 'standby' });
    expect(statusStore.getState().state).toBe('standby');
    expect(mockTransport.pull).not.toHaveBeenCalled();
    expect(mockTransport.push).not.toHaveBeenCalled();
    expect(await queueRepo.countPending()).toBe(1);

    // 3. Guest fallback credentials
    const guestCreds: SessionCredentials = {
      userId: 'user_default',
      deviceId: 'dev-guest-1',
      token: 'guest_token',
    };
    const resultGuest = await engine.sync(guestCreds);
    expect(resultGuest).toEqual({ status: 'standby' });
    expect(statusStore.getState().state).toBe('standby');
    expect(mockTransport.pull).not.toHaveBeenCalled();
    expect(mockTransport.push).not.toHaveBeenCalled();
    expect(await queueRepo.countPending()).toBe(1);
  });

  it('Single-leader Web Lock fencing: returns skipped_concurrent_tab when lock is held by another tab', async () => {
    const mockLockCoordinator = {
      runExclusiveSync: vi.fn().mockResolvedValue({ status: 'skipped_concurrent_tab' }),
    } as unknown as VaultSyncLockCoordinator;

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
      lockCoordinator: mockLockCoordinator,
    });

    const result = await engine.sync(credentials);

    expect(result).toEqual({ status: 'skipped_concurrent_tab' });
    expect(mockTransport.pull).not.toHaveBeenCalled();
    expect(mockTransport.push).not.toHaveBeenCalled();
    // StatusStore remains untouched in its prior state (idle)
    expect(statusStore.getState().state).toBe('idle');
  });

  it('notifies SyncEventSink with appliedCount and touchedEntities when remote changes are applied', async () => {
    const pull1: SyncPullResponse = {
      newCursor: 10,
      hasMore: false,
      changes: [
        {
          sequence: 10,
          entityType: 'document',
          entityId: 'doc-remote-1',
          operation: 'UPSERT',
          version: 1,
          changedAt: '2026-08-27T09:50:00.000Z',
          data: {
            title: 'Remote Doc',
            content: '# Content',
          },
        },
        {
          sequence: 11,
          entityType: 'highlight',
          entityId: 'hl-remote-1',
          operation: 'UPSERT',
          changedAt: '2026-08-27T09:51:00.000Z',
          data: {
            id: 'hl-remote-1',
            documentId: 'doc-remote-1',
            start: 0,
            end: 5,
            color: 'yellow',
            text: 'Remote',
            createdAt: '2026-08-27T09:51:00.000Z',
          },
        },
      ],
    };

    vi.mocked(mockTransport.pull).mockResolvedValueOnce(pull1);

    const onApplied = vi.fn();
    const sink: SyncEventSink = { onApplied };

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
      syncEventSink: sink,
    });

    await engine.sync(credentials);

    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onApplied).toHaveBeenCalledWith({
      appliedCount: 2,
      touchedEntities: expect.arrayContaining(['document', 'highlight']),
    });
  });

  it('does not notify SyncEventSink when no remote changes are applied', async () => {
    const onApplied = vi.fn();
    const sink: SyncEventSink = { onApplied };

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
      syncEventSink: sink,
    });

    await engine.sync(credentials);

    expect(onApplied).not.toHaveBeenCalled();
  });

  it('supports setting SyncEventSink dynamically via setSyncEventSink', async () => {
    const pull1: SyncPullResponse = {
      newCursor: 10,
      hasMore: false,
      changes: [
        {
          sequence: 10,
          entityType: 'document',
          entityId: 'doc-remote-dyn',
          operation: 'UPSERT',
          version: 1,
          changedAt: '2026-08-27T09:50:00.000Z',
          data: { title: 'Dynamic Doc', content: '# Content' },
        },
      ],
    };

    vi.mocked(mockTransport.pull).mockResolvedValueOnce(pull1);

    const onApplied = vi.fn();
    const sink: SyncEventSink = { onApplied };

    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    engine.setSyncEventSink(sink);

    await engine.sync(credentials);

    expect(onApplied).toHaveBeenCalledWith({
      appliedCount: 1,
      touchedEntities: ['document'],
    });
  });

  it('rejects sync after dispose() is called', async () => {
    const engine = new SyncEngine({
      transport: mockTransport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    engine.dispose();

    await expect(engine.sync(credentials)).rejects.toThrow('SyncEngine is disposed');
  });
});
