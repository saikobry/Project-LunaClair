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
import { VaultSyncLockCoordinator } from './locks/VaultSyncLockCoordinator';
import type { SyncEventSink } from './SyncEventSink';

export interface SyncEngineDependencies {
  transport: SyncTransport;
  reconciler: SyncReconciler;
  queueRepo: SyncQueueRepository;
  stateRepo: SyncStateRepository;
  statusStore: SyncStatusStore;
  retryPolicy?: SyncRetryPolicy;
  lockCoordinator?: VaultSyncLockCoordinator;
  syncEventSink?: SyncEventSink;
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
  private readonly lockCoordinator: VaultSyncLockCoordinator;
  private syncEventSink?: SyncEventSink;

  private runningPromise: Promise<{ status: 'standby' | 'skipped_concurrent_tab' } | void> | null = null;
  private followUpRequested = false;
  private disposed = false;
  private readonly lifecycleController = new AbortController();

  constructor(dependencies: SyncEngineDependencies);
  constructor(
    transport: SyncTransport,
    reconciler: SyncReconciler,
    queueRepo: SyncQueueRepository,
    stateRepo: SyncStateRepository,
    statusStore: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy,
    lockCoordinator?: VaultSyncLockCoordinator,
    syncEventSink?: SyncEventSink
  );
  constructor(
    depsOrTransport: SyncEngineDependencies | SyncTransport,
    reconciler?: SyncReconciler,
    queueRepo?: SyncQueueRepository,
    stateRepo?: SyncStateRepository,
    statusStore?: SyncStatusStore,
    retryPolicy?: SyncRetryPolicy,
    lockCoordinator?: VaultSyncLockCoordinator,
    syncEventSink?: SyncEventSink
  ) {
    if ('transport' in depsOrTransport) {
      this.transport = depsOrTransport.transport;
      this.reconciler = depsOrTransport.reconciler;
      this.queueRepo = depsOrTransport.queueRepo;
      this.stateRepo = depsOrTransport.stateRepo;
      this.statusStore = depsOrTransport.statusStore;
      this.retryPolicy = depsOrTransport.retryPolicy ?? defaultSyncRetryPolicy;
      this.lockCoordinator = depsOrTransport.lockCoordinator ?? new VaultSyncLockCoordinator();
      this.syncEventSink = depsOrTransport.syncEventSink;
    } else {
      this.transport = depsOrTransport;
      this.reconciler = reconciler!;
      this.queueRepo = queueRepo!;
      this.stateRepo = stateRepo!;
      this.statusStore = statusStore!;
      this.retryPolicy = retryPolicy ?? defaultSyncRetryPolicy;
      this.lockCoordinator = lockCoordinator ?? new VaultSyncLockCoordinator();
      this.syncEventSink = syncEventSink;
    }
  }

  public setSyncEventSink(sink?: SyncEventSink): void {
    this.syncEventSink = sink;
  }

  dispose(): void {
    this.disposed = true;
    this.followUpRequested = false;
    this.lifecycleController.abort();
  }

  /**
   * Triggers a synchronization cycle with the single-flight mutex and multi-tab Web Lock.
   * If a cycle is currently running, flags a follow-up run and returns the current running promise.
   * If credentials are null or unauthenticated, immediately enters standby state without touching syncQueue.
   */
  sync(credentials?: SessionCredentials | null): Promise<{ status: 'standby' | 'skipped_concurrent_tab' } | void> {
    if (this.disposed || this.lifecycleController.signal.aborted) {
      return Promise.reject(new Error('SyncEngine is disposed'));
    }

    const isUnauthenticated =
      !credentials ||
      !credentials.userId ||
      credentials.userId === 'user_default';

    if (isUnauthenticated) {
      this.statusStore.setState({ state: 'standby' });
      return Promise.resolve({ status: 'standby' });
    }

    if (this.runningPromise !== null) {
      this.followUpRequested = true;
      return this.runningPromise;
    }

    const currentRun = (async () => {
      try {
        const lockResult = await this.lockCoordinator.runExclusiveSync(
          credentials.userId,
          async ({ signal, reportProgress }) => {
            await this.executeCycle(credentials, signal, reportProgress);
          }
        );

        if (lockResult.status === 'skipped_concurrent_tab') {
          return { status: 'skipped_concurrent_tab' } as const;
        }
      } finally {
        this.runningPromise = null;
        if (this.followUpRequested && !this.disposed && !this.lifecycleController.signal.aborted) {
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
  private async executeCycle(
    credentials: SessionCredentials,
    signal?: AbortSignal,
    reportProgress?: () => void
  ): Promise<void> {
    if (this.disposed || this.lifecycleController.signal.aborted) {
      return;
    }

    const combinedSignal = signal
      ? (typeof AbortSignal.any === 'function'
          ? AbortSignal.any([signal, this.lifecycleController.signal])
          : signal)
      : this.lifecycleController.signal;

    if (combinedSignal.aborted) {
      return;
    }

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
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      const stateKey = createSyncStateKey(credentials.userId, credentials.deviceId);

      // Rehydrate pending count before cycle starts
      const initialPending = await this.queueRepo.countPending();
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      this.statusStore.setState({ pendingCount: initialPending });
      reportProgress?.();

      // Step 1: Pull until caught up (Initial pull)
      const pullResult = await this.pullUntilCaughtUp(credentials, stateKey, combinedSignal, reportProgress);
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      let cursor = pullResult.cursor;
      let totalApplied = pullResult.appliedCount;
      const allTouchedEntities = new Set<string>(pullResult.touchedEntities);

      // Step 2: Push pending batches
      const pushResult = await this.pushPendingBatches(credentials, combinedSignal, reportProgress);
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      // Step 3: Pull again ONLY if mutations were pushed or remote changes were applied in step 1
      if (pushResult.pushedCount > 0 || pullResult.appliedChangesCount > 0) {
        const secondPull = await this.pullUntilCaughtUp(credentials, stateKey, combinedSignal, reportProgress);
        if (this.disposed || combinedSignal.aborted) {
          throw combinedSignal.reason ?? new Error('Sync aborted');
        }
        cursor = secondPull.cursor;
        totalApplied += secondPull.appliedCount;
        for (const entity of secondPull.touchedEntities) {
          allTouchedEntities.add(entity);
        }
      }

      // Step 4: Finalize and mark idle
      reportProgress?.();
      const finalPending = await this.queueRepo.countPending();
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      const now = new Date().toISOString();
      const existingState = await this.stateRepo.getSyncState(stateKey);
      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      await this.stateRepo.saveSyncState({
        ...existingState,
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: cursor,
        lastSyncedAt: now,
      });

      if (this.disposed || combinedSignal.aborted) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      this.statusStore.setState({
        state: 'idle',
        pendingCount: finalPending,
        lastSyncedAt: now,
        lastServerCursor: cursor,
        lastError: undefined,
      });

      if (totalApplied > 0) {
        this.syncEventSink?.onApplied({
          appliedCount: totalApplied,
          touchedEntities: Array.from(allTouchedEntities),
        });
      }
    } catch (error) {
      if (this.disposed || this.lifecycleController.signal.aborted || combinedSignal.aborted) {
        return;
      }
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
    stateKey: string,
    signal?: AbortSignal,
    reportProgress?: () => void
  ): Promise<{
    cursor: number;
    appliedChangesCount: number;
    appliedCount: number;
    touchedEntities: readonly string[];
  }> {
    const syncState = await this.stateRepo.getSyncState(stateKey);
    let cursor = syncState?.lastServerCursor ?? 0;
    let hasMore = true;
    let appliedChangesCount = 0;
    let appliedCount = 0;
    const touchedEntitiesSet = new Set<string>();

    while (hasMore) {
      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }

      const pullResponse = signal
        ? await this.transport.pull(credentials, cursor, 100, signal)
        : await this.transport.pull(credentials, cursor, 100);
      reportProgress?.();

      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }

      const reconcileResult = await this.reconciler.reconcilePullBatch(
        credentials.userId,
        credentials.deviceId,
        cursor,
        pullResponse
      );
      reportProgress?.();

      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }
      const currentApplied = reconcileResult?.appliedCount ?? 0;
      appliedCount += currentApplied;
      appliedChangesCount += currentApplied + (reconcileResult?.conflictCount ?? 0);
      if (reconcileResult?.touchedEntities) {
        for (const entity of reconcileResult.touchedEntities) {
          touchedEntitiesSet.add(entity);
        }
      }

      cursor = pullResponse.newCursor;
      this.statusStore.setState({ lastServerCursor: cursor });

      const freshState = await this.stateRepo.getSyncState(stateKey);
      await this.stateRepo.saveSyncState({
        ...freshState,
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: cursor,
        lastSyncedAt: freshState?.lastSyncedAt,
      });

      hasMore = pullResponse.hasMore;
    }

    return {
      cursor,
      appliedChangesCount,
      appliedCount,
      touchedEntities: Array.from(touchedEntitiesSet),
    };
  }

  /**
   * Drains the local outbox queue in chunks of 50 up to maxBatchesPerCycle = 10.
   */
  private async pushPendingBatches(
    credentials: SessionCredentials,
    signal?: AbortSignal,
    reportProgress?: () => void
  ): Promise<{ pushedCount: number }> {
    let pushedCount = 0;
    const maxBatchesPerCycle = 10;

    for (let batch = 0; batch < maxBatchesPerCycle; batch++) {
      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }

      const pending = await this.queueRepo.peekPending(50);
      if (pending.length === 0) {
        break;
      }

      const pushRequest: SyncPushRequest = {
        deviceId: credentials.deviceId,
        mutations: pending,
      };

      const pushResponse = signal
        ? await this.transport.push(credentials, pushRequest, signal)
        : await this.transport.push(credentials, pushRequest);
      reportProgress?.();

      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }

      pushedCount += pending.length;

      await this.reconciler.applyPushResult(
        credentials.userId,
        credentials.deviceId,
        pushRequest,
        pushResponse
      );
      reportProgress?.();

      if (this.disposed || this.lifecycleController.signal.aborted || signal?.aborted) {
        throw signal?.reason ?? this.lifecycleController.signal.reason ?? new Error('Sync aborted');
      }

      const remaining = await this.queueRepo.countPending();
      this.statusStore.setState({ pendingCount: remaining });
    }

    return { pushedCount };
  }

  public getRetryPolicy(): SyncRetryPolicy {
    return this.retryPolicy;
  }
}
