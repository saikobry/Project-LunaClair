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
import type { SyncControlPort } from '../../domain/sync/services/SyncControlPort';

export interface SyncEngineDependencies {
  transport: SyncTransport;
  reconciler: SyncReconciler;
  queueRepo: SyncQueueRepository;
  stateRepo: SyncStateRepository;
  statusStore: SyncStatusStore;
  retryPolicy?: SyncRetryPolicy;
  lockCoordinator?: VaultSyncLockCoordinator;
  syncEventSink?: SyncEventSink;
  expectedOwnerSub?: string;
  syncControlPort?: SyncControlPort;
  hydrationManager?: { pause: () => void; resume?: () => void };
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

  private runningPromise: Promise<{ status: 'standby' | 'skipped_concurrent_tab' | 'paused' } | void> | null = null;
  private followUpRequested = false;
  private disposed = false;
  private readonly lifecycleController = new AbortController();
  private currentCycleController: AbortController | null = null;
  private activeOwnerSub?: string;
  private expectedOwnerSub?: string;
  private readonly pausedOwners = new Set<string>();
  private readonly syncControlPort?: SyncControlPort;
  private hydrationManager?: { pause: () => void; resume?: () => void };

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
      this.expectedOwnerSub = depsOrTransport.expectedOwnerSub;
      this.syncControlPort = depsOrTransport.syncControlPort;
      this.hydrationManager = depsOrTransport.hydrationManager;
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

    if (this.isPaused()) {
      this.statusStore.setState({ state: 'paused' });
    } else if (this.statusStore.getState().state === 'paused') {
      this.statusStore.setState({ state: 'idle' });
    }
  }

  public setSyncEventSink(sink?: SyncEventSink): void {
    this.syncEventSink = sink;
  }

  public setHydrationManager(manager?: { pause: () => void; resume?: () => void }): void {
    this.hydrationManager = manager;
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
   * If paused, immediately enters paused state and returns { status: 'paused' }.
   */
  sync(credentials?: SessionCredentials | null): Promise<{ status: 'standby' | 'skipped_concurrent_tab' | 'paused' } | void> {
    if (this.disposed || this.lifecycleController.signal.aborted) {
      return Promise.reject(new Error('SyncEngine is disposed'));
    }

    if (credentials?.userId && credentials.userId !== 'user_default') {
      this.activeOwnerSub = credentials.userId;
    }

    if (this.isPaused(credentials?.userId)) {
      this.statusStore.setState({ state: 'paused' });
      return Promise.resolve({ status: 'paused' });
    }

    const isUnauthenticated =
      !credentials ||
      !credentials.userId ||
      credentials.userId === 'user_default';

    if (isUnauthenticated) {
      this.statusStore.setState({ state: 'standby' });
      return Promise.resolve({ status: 'standby' });
    }

    const isMismatched =
      this.expectedOwnerSub !== undefined &&
      (this.expectedOwnerSub === 'ANONYMOUS' ||
        this.expectedOwnerSub === 'anonymous' ||
        credentials.userId !== this.expectedOwnerSub);

    if (isMismatched) {
      this.statusStore.setState({ state: 'standby' });
      return Promise.resolve({ status: 'standby' });
    }

    if (this.runningPromise !== null) {
      this.followUpRequested = true;
      return this.runningPromise;
    }

    const currentRun = (async () => {
      this.currentCycleController = new AbortController();
      try {
        const lockResult = await this.lockCoordinator.runExclusiveSync(
          credentials.userId,
          async ({ signal, reportProgress }) => {
            if (this.isPaused(credentials.userId)) {
              return;
            }
            await this.executeCycle(credentials, signal, reportProgress);
          }
        );

        if (lockResult.status === 'skipped_concurrent_tab') {
          return { status: 'skipped_concurrent_tab' } as const;
        }
      } finally {
        this.currentCycleController = null;
        this.runningPromise = null;
        if (this.followUpRequested && !this.disposed && !this.lifecycleController.signal.aborted && !this.isPaused(credentials.userId)) {
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
   * Pauses synchronization independently of auth state or library selection.
   * Retains pending syncQueue, aborts any in-flight sync cycle safely, persists paused state,
   * and marks the status store as paused.
   */
  pause(ownerSub?: string): void {
    const targetSub = ownerSub ?? this.activeOwnerSub ?? this.expectedOwnerSub;
    if (targetSub) {
      this.pausedOwners.add(targetSub);
    } else {
      this.pausedOwners.add('__all__');
    }

    try {
      this.syncControlPort?.pause(targetSub);
    } catch {
      // Persistence failure must not affect in-memory pause
    }

    this.followUpRequested = false;
    if (this.currentCycleController) {
      this.currentCycleController.abort(new Error('Sync paused'));
      this.currentCycleController = null;
    }

    this.hydrationManager?.pause();

    this.statusStore.setState({ state: 'paused' });
  }

  /**
   * Resumes synchronization for the matching authenticated owner.
   * Stays on the same library and verifies identity before unpausing.
   */
  async resume(credentials?: SessionCredentials | null, expectedOwnerSub?: string): Promise<void> {
    if (!credentials || !credentials.userId || credentials.userId === 'user_default') {
      return;
    }

    if (expectedOwnerSub && credentials.userId !== expectedOwnerSub) {
      return;
    }

    const targetSub = credentials.userId;
    this.pausedOwners.delete(targetSub);
    if (expectedOwnerSub) {
      this.pausedOwners.delete(expectedOwnerSub);
    }
    this.pausedOwners.delete('__all__');

    try {
      this.syncControlPort?.resume(targetSub);
      if (expectedOwnerSub && expectedOwnerSub !== targetSub) {
        this.syncControlPort?.resume(expectedOwnerSub);
      }
    } catch {
      // Ignore storage errors
    }

    this.hydrationManager?.resume?.();

    this.statusStore.setState({ state: 'idle' });
    await this.sync(credentials);
  }

  /**
   * Checks whether synchronization is currently paused, optionally scoped to a user/owner sub.
   */
  isPaused(ownerSub?: string): boolean {
    if (this.pausedOwners.has('__all__')) {
      return true;
    }
    const targetSub = ownerSub ?? this.activeOwnerSub ?? this.expectedOwnerSub;
    if (targetSub) {
      if (this.pausedOwners.has(targetSub)) {
        return true;
      }
      try {
        if (this.syncControlPort?.isPaused(targetSub)) {
          return true;
        }
      } catch {
        // Ignore storage errors
      }
      return false;
    }
    try {
      if (this.syncControlPort?.isPaused()) {
        return true;
      }
    } catch {
      // Ignore storage errors
    }
    return false;
  }

  private combineSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
    const valid = signals.filter((s): s is AbortSignal => Boolean(s));
    if (valid.length === 0) return this.lifecycleController.signal;
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any(valid);
    }
    const controller = new AbortController();
    for (const s of valid) {
      if (s.aborted) {
        controller.abort(s.reason);
        return controller.signal;
      }
      s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
    }
    return controller.signal;
  }

  /**
   * Internal execution of the 4-step convergence cycle.
   */
  private async executeCycle(
    credentials: SessionCredentials,
    signal?: AbortSignal,
    reportProgress?: () => void
  ): Promise<void> {
    if (this.disposed || this.lifecycleController.signal.aborted || this.isPaused(credentials.userId)) {
      return;
    }

    const cycleSignal = this.currentCycleController?.signal;
    const combinedSignal = this.combineSignals([signal, this.lifecycleController.signal, cycleSignal]);

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
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      const stateKey = createSyncStateKey(credentials.userId, credentials.deviceId);

      // Rehydrate pending count before cycle starts
      const initialPending = await this.queueRepo.countPending();
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      this.statusStore.setState({ pendingCount: initialPending });
      reportProgress?.();

      // Step 1: Pull until caught up (Initial pull)
      const pullResult = await this.pullUntilCaughtUp(credentials, stateKey, combinedSignal, reportProgress);
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      let cursor = pullResult.cursor;
      let totalApplied = pullResult.appliedCount;
      const allTouchedEntities = new Set<string>(pullResult.touchedEntities);

      // Step 2: Push pending batches
      const pushResult = await this.pushPendingBatches(credentials, combinedSignal, reportProgress);
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }

      // Step 3: Pull again ONLY if mutations were pushed or remote changes were applied in step 1
      if (pushResult.pushedCount > 0 || pullResult.appliedChangesCount > 0) {
        const secondPull = await this.pullUntilCaughtUp(credentials, stateKey, combinedSignal, reportProgress);
        if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
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
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
        throw combinedSignal.reason ?? new Error('Sync aborted');
      }
      const now = new Date().toISOString();
      const existingState = await this.stateRepo.getSyncState(stateKey);
      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
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

      if (this.disposed || combinedSignal.aborted || this.isPaused(credentials.userId)) {
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
      if (this.disposed || this.lifecycleController.signal.aborted || combinedSignal.aborted || this.isPaused(credentials.userId)) {
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
