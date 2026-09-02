import { createSyncStateKey } from '../../domain/sync/utils/syncIdentity';
import { SyncNetworkError } from '../../domain/sync/errors/SyncErrors';
import type { SessionCredentials } from '../../domain/sync/models/sync.types';
import type { SyncPushRequest, SyncTransport } from '../../domain/sync/services/SyncTransport';
import type { SyncQueueRepository } from '../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../domain/sync/repositories/SyncStateRepository';
import type { SyncRetryPolicy } from '../../domain/sync/policies/SyncRetryPolicy';
import type { SyncReconciler } from '../../domain/sync/services/SyncReconciler';
import { defaultSyncRetryPolicy } from './policies/syncRetryPolicy';
import type { SyncStatusStore } from './SyncStatusStore';

export interface SyncEngineDependencies {
  transport: SyncTransport;
  reconciler: SyncReconciler;
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
  private readonly transport: SyncTransport;
  private readonly reconciler: SyncReconciler;
  private readonly queueRepo: SyncQueueRepository;
  private readonly stateRepo: SyncStateRepository;
  private readonly statusStore: SyncStatusStore;
  private readonly retryPolicy: SyncRetryPolicy;

  private runningPromise: Promise<void> | null = null;
  private followUpRequested = false;

  constructor(dependencies: SyncEngineDependencies);
  constructor(
    transport: SyncTransport,
    reconciler: SyncReconciler,
    queueRepo: SyncQueueRepository,
    stateRepo: SyncStateRepository,
    statusStore: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy
  );
  constructor(
    depsOrTransport: SyncEngineDependencies | SyncTransport,
    reconciler?: SyncReconciler,
    queueRepo?: SyncQueueRepository,
    stateRepo?: SyncStateRepository,
    statusStore?: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy
  ) {
    if ('transport' in depsOrTransport) {
      this.transport = depsOrTransport.transport;
      this.reconciler = depsOrTransport.reconciler;
      this.queueRepo = depsOrTransport.queueRepo;
      this.stateRepo = depsOrTransport.stateRepo;
      this.statusStore = depsOrTransport.statusStore;
      this.retryPolicy = depsOrTransport.retryPolicy ?? defaultSyncRetryPolicy;
    } else {
      this.transport = depsOrTransport;
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
      const pullResult = await this.pullUntilCaughtUp(credentials, stateKey);
      let cursor = pullResult.cursor;

      // Step 2: Push pending batches
      const pushResult = await this.pushPendingBatches(credentials, stateKey, cursor);
      cursor = pushResult.cursor;

      // Step 3: Pull again ONLY if mutations were pushed or remote changes were applied in step 1
      if (pushResult.pushedCount > 0 || pullResult.appliedChangesCount > 0) {
        const secondPull = await this.pullUntilCaughtUp(credentials, stateKey);
        cursor = secondPull.cursor;
      }

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
  ): Promise<{ cursor: number; appliedChangesCount: number }> {
    const syncState = await this.stateRepo.getSyncState(stateKey);
    let cursor = syncState?.lastServerCursor ?? 0;
    let hasMore = true;
    let appliedChangesCount = 0;

    while (hasMore) {
      const pullResponse = await this.transport.pull(credentials, cursor, 100);
      const reconcileResult = await this.reconciler.reconcilePullBatch(
        credentials.userId,
        credentials.deviceId,
        cursor,
        pullResponse
      );
      appliedChangesCount += (reconcileResult?.appliedCount ?? 0) + (reconcileResult?.conflictCount ?? 0);

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

    return { cursor, appliedChangesCount };
  }

  /**
   * Drains the local outbox queue in chunks of 50 up to maxBatchesPerCycle = 10.
   */
  private async pushPendingBatches(
    credentials: SessionCredentials,
    stateKey: string,
    currentCursor: number
  ): Promise<{ cursor: number; pushedCount: number }> {
    let cursor = currentCursor;
    let pushedCount = 0;
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
      pushedCount += pending.length;

      await this.reconciler.applyPushResult(
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

    return { cursor, pushedCount };
  }

  public getRetryPolicy(): SyncRetryPolicy {
    return this.retryPolicy;
  }
}
