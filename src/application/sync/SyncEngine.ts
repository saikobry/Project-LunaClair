import type { LunaClairDatabase } from '../../infrastructure/database/LunaClairDatabase';
import type { DexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';
import {
  createSyncStateKey,
  SyncNetworkError,
  type SessionCredentials,
  type SyncPushRequest,
  type SyncQueueRepository,
  type SyncRetryPolicy,
  type SyncStateRepository,
  type SyncTransport,
} from '../../domain/sync';
import { defaultSyncRetryPolicy } from './policies/syncRetryPolicy';
import type { SyncStatusStore } from './SyncStatusStore';

export interface SyncEngineDependencies {
  db: LunaClairDatabase;
  transport: SyncTransport;
  reconciler: DexieSyncReconciler;
  queueRepo: SyncQueueRepository;
  stateRepo: SyncStateRepository;
  statusStore: SyncStatusStore;
  retryPolicy?: SyncRetryPolicy;
}

/**
 * SyncEngine orchestrates the 4-step convergence cycle, single-flight mutex,
 * outbox push batching, and reactive status store updates.
 */
export class SyncEngine {
  private readonly db: LunaClairDatabase;
  private readonly transport: SyncTransport;
  private readonly reconciler: DexieSyncReconciler;
  private readonly queueRepo: SyncQueueRepository;
  private readonly stateRepo: SyncStateRepository;
  private readonly statusStore: SyncStatusStore;
  private readonly retryPolicy: SyncRetryPolicy;

  private runningPromise: Promise<void> | null = null;
  private followUpRequested = false;

  constructor(dependencies: SyncEngineDependencies);
  constructor(
    db: LunaClairDatabase,
    transport: SyncTransport,
    reconciler: DexieSyncReconciler,
    queueRepo: SyncQueueRepository,
    stateRepo: SyncStateRepository,
    statusStore: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy
  );
  constructor(
    dbOrDeps: LunaClairDatabase | SyncEngineDependencies,
    transport?: SyncTransport,
    reconciler?: DexieSyncReconciler,
    queueRepo?: SyncQueueRepository,
    stateRepo?: SyncStateRepository,
    statusStore?: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy
  ) {
    if ('db' in dbOrDeps && 'transport' in dbOrDeps) {
      this.db = dbOrDeps.db;
      this.transport = dbOrDeps.transport;
      this.reconciler = dbOrDeps.reconciler;
      this.queueRepo = dbOrDeps.queueRepo;
      this.stateRepo = dbOrDeps.stateRepo;
      this.statusStore = dbOrDeps.statusStore;
      this.retryPolicy = dbOrDeps.retryPolicy ?? defaultSyncRetryPolicy;
    } else {
      this.db = dbOrDeps;
      this.transport = transport!;
      this.reconciler = reconciler!;
      this.queueRepo = queueRepo!;
      this.stateRepo = stateRepo!;
      this.statusStore = statusStore!;
      this.retryPolicy = retryPolicy ?? defaultSyncRetryPolicy;
    }
  }

  /**
   * Triggers a synchronization cycle with the single-flight mutex.
   * If a cycle is currently running, flags a follow-up run and returns the current running promise.
   */
  sync(credentials: SessionCredentials): Promise<void> {
    if (this.runningPromise !== null) {
      this.followUpRequested = true;
      return this.runningPromise;
    }

    const currentRun = (async () => {
      try {
        await this.executeCycle(credentials);
      } finally {
        this.runningPromise = null;
        if (this.followUpRequested) {
          this.followUpRequested = false;
          // Execute requested follow-up cycle
          await this.sync(credentials);
        }
      }
    })();

    this.runningPromise = currentRun;
    return currentRun;
  }



  /**
   * Internal execution of the 4-step convergence cycle.
   */
  private async executeCycle(credentials: SessionCredentials): Promise<void> {
    const isOffline =
      typeof navigator !== 'undefined' &&
      typeof navigator.onLine === 'boolean' &&
      !navigator.onLine;

    if (isOffline) {
      this.statusStore.setState({ state: 'offline' });
      return;
    }

    this.statusStore.setState({ state: 'syncing', lastError: undefined });

    try {
      const stateKey = createSyncStateKey(credentials.userId, credentials.deviceId);

      // Rehydrate pending count before cycle starts
      const initialPending = await this.queueRepo.countPending();
      this.statusStore.setState({ pendingCount: initialPending });

      // Step 1: Pull until caught up (Initial pull)
      let cursor = await this.pullUntilCaughtUp(credentials, stateKey);

      // Step 2: Push pending batches
      cursor = await this.pushPendingBatches(credentials, stateKey, cursor);

      // Step 3: Pull until caught up (Catch concurrent remote changes)
      cursor = await this.pullUntilCaughtUp(credentials, stateKey);

      // Step 4: Finalize and mark idle
      const finalPending = await this.queueRepo.countPending();
      const now = new Date().toISOString();

      await this.stateRepo.saveSyncState({
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: cursor,
        lastSyncedAt: now,
      });

      this.statusStore.setState({
        state: 'idle',
        pendingCount: finalPending,
        lastSyncedAt: now,
        lastServerCursor: cursor,
        lastError: undefined,
      });
    } catch (error) {
      const isNetworkFail =
        (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) ||
        error instanceof SyncNetworkError ||
        (error instanceof Error && /network|offline|failed to fetch/i.test(error.message));

      if (isNetworkFail) {
        this.statusStore.setState({ state: 'offline' });
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.statusStore.setState({
          state: 'error',
          lastError: errorMessage,
        });
      }
    }
  }

  /**
   * Paginates through server pull response batches until `hasMore: false`.
   */
  private async pullUntilCaughtUp(
    credentials: SessionCredentials,
    stateKey: string
  ): Promise<number> {
    const syncState = await this.stateRepo.getSyncState(stateKey);
    let cursor = syncState?.lastServerCursor ?? 0;
    let hasMore = true;

    while (hasMore) {
      const pullResponse = await this.transport.pull(credentials, cursor, 100);
      await this.reconciler.reconcilePullBatch(
        this.db,
        credentials.userId,
        credentials.deviceId,
        cursor,
        pullResponse
      );

      cursor = pullResponse.newCursor;
      this.statusStore.setState({ lastServerCursor: cursor });

      await this.stateRepo.saveSyncState({
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: cursor,
        lastSyncedAt: syncState?.lastSyncedAt,
      });

      hasMore = pullResponse.hasMore;
    }

    return cursor;
  }

  /**
   * Drains the local outbox queue in chunks of 50 up to maxBatchesPerCycle = 10.
   */
  private async pushPendingBatches(
    credentials: SessionCredentials,
    stateKey: string,
    currentCursor: number
  ): Promise<number> {
    let cursor = currentCursor;
    const maxBatchesPerCycle = 10;

    for (let batch = 0; batch < maxBatchesPerCycle; batch++) {
      const pending = await this.queueRepo.peekPending(50);
      if (pending.length === 0) {
        break;
      }

      const pushRequest: SyncPushRequest = {
        deviceId: credentials.deviceId,
        mutations: pending,
      };

      const pushResponse = await this.transport.push(credentials, pushRequest);
      await this.reconciler.applyPushResult(
        this.db,
        credentials.userId,
        credentials.deviceId,
        pushRequest,
        pushResponse
      );

      if (pushResponse.serverCursor !== undefined && pushResponse.serverCursor > cursor) {
        cursor = pushResponse.serverCursor;
        this.statusStore.setState({ lastServerCursor: cursor });
        await this.stateRepo.saveSyncState({
          key: stateKey,
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          lastServerCursor: cursor,
        });
      }

      const remaining = await this.queueRepo.countPending();
      this.statusStore.setState({ pendingCount: remaining });
    }

    return cursor;
  }

  /**
   * Sets up automatic background synchronization triggers:
   * - online event listener
   * - visibilitychange event listener (when document becomes visible)
   * - periodic interval timer (default: every 60s)
   *
   * Returns a cleanup unsubscribe function.
   */
  startAutoSync(credentials: SessionCredentials, intervalMs: number = 60000): () => void {
    const onOnline = () => {
      void this.sync(credentials);
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void this.sync(credentials);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const timerId = setInterval(() => {
      void this.sync(credentials);
    }, intervalMs);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      clearInterval(timerId);
    };
  }

  public getRetryPolicy(): SyncRetryPolicy {
    return this.retryPolicy;
  }
}
