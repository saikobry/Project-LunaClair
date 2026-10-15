export interface LockHeartbeat {
  tabId: string;
  acquiredAt: number;
  lastProgressAt: number;
}

export interface VaultSyncLockContext {
  signal: AbortSignal;
  reportProgress: () => void;
}

export type VaultSyncLockResult<T> =
  | { status: 'acquired'; result: T }
  | { status: 'skipped_concurrent_tab' };

export interface VaultSyncLockCoordinatorOptions {
  tabId?: string;
  inactivityTimeoutMs?: number;
  staleHeartbeatThresholdMs?: number;
  storage?: Storage;
}

/**
 * VaultSyncLockCoordinator provides single-leader multi-tab mutex coordination
 * using the Web Locks API with non-blocking acquisition, inactivity watchdog,
 * freeze/pagehide tab termination listeners, and stale-heartbeat steal recovery.
 */
export class VaultSyncLockCoordinator {
  private readonly tabId: string;
  private readonly inactivityTimeoutMs: number;
  private readonly staleHeartbeatThresholdMs: number;
  private readonly storage?: Storage;

  constructor(options?: VaultSyncLockCoordinatorOptions) {
    this.tabId =
      options?.tabId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`);
    this.inactivityTimeoutMs = options?.inactivityTimeoutMs ?? 30_000;
    this.staleHeartbeatThresholdMs = options?.staleHeartbeatThresholdMs ?? 45_000;
    this.storage =
      options?.storage ??
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : undefined);
  }

  public getTabId(): string {
    return this.tabId;
  }

  public getHeartbeatKey(vaultId: string): string {
    return `vault_sync_lock_heartbeat:${vaultId}`;
  }

  public getLockName(vaultId: string): string {
    return `vault_sync_lock:${vaultId}`;
  }

  public getHeartbeat(vaultId: string): LockHeartbeat | null {
    try {
      const raw = this.storage?.getItem(this.getHeartbeatKey(vaultId));
      if (!raw) return null;
      return JSON.parse(raw) as LockHeartbeat;
    } catch {
      return null;
    }
  }

  public saveHeartbeat(vaultId: string, heartbeat: LockHeartbeat): void {
    try {
      this.storage?.setItem(this.getHeartbeatKey(vaultId), JSON.stringify(heartbeat));
    } catch {
      // Gracefully ignore storage quota or permission failures
    }
  }

  public clearHeartbeat(vaultId: string): void {
    try {
      const current = this.getHeartbeat(vaultId);
      if (current?.tabId === this.tabId) {
        this.storage?.removeItem(this.getHeartbeatKey(vaultId));
      }
    } catch {
      // Gracefully ignore storage removal failures
    }
  }

  public async runExclusiveSync<T>(
    vaultId: string,
    task: (context: VaultSyncLockContext) => Promise<T>
  ): Promise<VaultSyncLockResult<T>> {
    const hasNavigatorLocks =
      typeof navigator !== 'undefined' &&
      typeof navigator.locks === 'object' &&
      navigator.locks !== null &&
      typeof navigator.locks.request === 'function';

    if (!hasNavigatorLocks) {
      // Fallback for Node / test environments without Web Locks API
      const result = await this.executeWithWatchdog(vaultId, task);
      return { status: 'acquired', result };
    }

    const lockName = this.getLockName(vaultId);
    let acquired = false;
    let taskResult: T | undefined;

    // 1. Non-blocking attempt with ifAvailable: true
    await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
      // CRITICAL: Handle the ifAvailable: true null return
      if (!lock) {
        return;
      }
      acquired = true;
      taskResult = await this.executeWithWatchdog(vaultId, task);
    });

    if (acquired) {
      return { status: 'acquired', result: taskResult as T };
    }

    // 2. Lock not acquired immediately; check if current lock holder is stale (>45s)
    const existingHeartbeat = this.getHeartbeat(vaultId);
    const now = Date.now();
    const isStale =
      existingHeartbeat !== null &&
      now - existingHeartbeat.lastProgressAt > this.staleHeartbeatThresholdMs;

    if (isStale) {
      // Steal lock from frozen / dead tab
      await navigator.locks.request(lockName, { steal: true }, async (lock) => {
        if (!lock) {
          return;
        }
        acquired = true;
        taskResult = await this.executeWithWatchdog(vaultId, task);
      });

      if (acquired) {
        return { status: 'acquired', result: taskResult as T };
      }
    }

    // Lock held by active concurrent tab
    return { status: 'skipped_concurrent_tab' };
  }

  private async executeWithWatchdog<T>(
    vaultId: string,
    task: (context: VaultSyncLockContext) => Promise<T>
  ): Promise<T> {
    const abortController = new AbortController();
    const now = Date.now();

    // Record initial heartbeat
    this.saveHeartbeat(vaultId, {
      tabId: this.tabId,
      acquiredAt: now,
      lastProgressAt: now,
    });

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const resetWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
      }
      watchdogTimer = setTimeout(() => {
        abortController.abort(new Error('Sync lock watchdog timed out due to inactivity'));
      }, this.inactivityTimeoutMs);
    };

    const reportProgress = () => {
      if (abortController.signal.aborted) {
        return;
      }
      const progressTime = Date.now();
      const current = this.getHeartbeat(vaultId);
      this.saveHeartbeat(vaultId, {
        tabId: this.tabId,
        acquiredAt: current?.acquiredAt ?? progressTime,
        lastProgressAt: progressTime,
      });
      resetWatchdog();
    };

    // Arm watchdog
    resetWatchdog();

    // Listen for tab freeze and unload
    const onFreeze = () => {
      abortController.abort(new Error('Browser tab frozen'));
    };
    const onPageHide = () => {
      abortController.abort(new Error('Browser tab pagehide / unload'));
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('freeze', onFreeze);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', onPageHide);
    }

    try {
      return await task({
        signal: abortController.signal,
        reportProgress,
      });
    } finally {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('freeze', onFreeze);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('pagehide', onPageHide);
      }
      this.clearHeartbeat(vaultId);
    }
  }
}
