import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VaultSyncLockCoordinator } from '../VaultSyncLockCoordinator';

interface MockLock {
  name: string;
  mode: string;
}

class MockLockManager {
  public heldLocks = new Map<string, { tabId?: string }>();
  public requestCalls: Array<{ name: string; options: any }> = [];

  request = vi.fn(
    async (
      name: string,
      optionsOrCallback: any,
      callback?: (lock: MockLock | null) => Promise<any>
    ) => {
      let options: { ifAvailable?: boolean; steal?: boolean } = {};
      let cb: (lock: MockLock | null) => Promise<any>;

      if (typeof optionsOrCallback === 'function') {
        cb = optionsOrCallback;
      } else {
        options = optionsOrCallback ?? {};
        cb = callback!;
      }

      this.requestCalls.push({ name, options });

      if (this.heldLocks.has(name)) {
        if (options.steal) {
          this.heldLocks.set(name, {});
          try {
            return await cb({ name, mode: 'exclusive' });
          } finally {
            this.heldLocks.delete(name);
          }
        }

        if (options.ifAvailable) {
          return await cb(null);
        }

        throw new Error('Lock queueing not implemented in test mock');
      }

      this.heldLocks.set(name, {});
      try {
        return await cb({ name, mode: 'exclusive' });
      } finally {
        this.heldLocks.delete(name);
      }
    }
  );

  holdLock(name: string) {
    this.heldLocks.set(name, {});
  }

  releaseLock(name: string) {
    this.heldLocks.delete(name);
  }
}

describe('VaultSyncLockCoordinator', () => {
  let mockLocks: MockLockManager;
  let originalLocks: any;

  beforeEach(() => {
    localStorage.clear();
    mockLocks = new MockLockManager();
    originalLocks = (navigator as any).locks;
    Object.defineProperty(navigator, 'locks', {
      value: mockLocks,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    if (originalLocks !== undefined) {
      Object.defineProperty(navigator, 'locks', {
        value: originalLocks,
        writable: true,
        configurable: true,
      });
    } else {
      delete (navigator as any).locks;
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('acquires lock and executes task when lock is available', async () => {
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-1' });
    let taskRan = false;

    const result = await coordinator.runExclusiveSync('vault-abc', async ({ signal }) => {
      taskRan = true;
      expect(signal.aborted).toBe(false);
      return 'task-result-ok';
    });

    expect(taskRan).toBe(true);
    expect(result).toEqual({ status: 'acquired', result: 'task-result-ok' });
    expect(mockLocks.requestCalls).toEqual([
      { name: 'vault_sync_lock:vault-abc', options: { ifAvailable: true } },
    ]);
  });

  it('returns skipped_concurrent_tab when lock is held with fresh heartbeat', async () => {
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-current' });
    mockLocks.holdLock('vault_sync_lock:vault-abc');

    // Other tab has active heartbeat (progressed 5s ago)
    const freshHeartbeat = {
      tabId: 'tab-other',
      acquiredAt: Date.now() - 10_000,
      lastProgressAt: Date.now() - 5_000,
    };
    coordinator.saveHeartbeat('vault-abc', freshHeartbeat);

    const task = vi.fn();
    const result = await coordinator.runExclusiveSync('vault-abc', task);

    expect(result).toEqual({ status: 'skipped_concurrent_tab' });
    expect(task).not.toHaveBeenCalled();
    expect(mockLocks.requestCalls).toEqual([
      { name: 'vault_sync_lock:vault-abc', options: { ifAvailable: true } },
    ]);
  });

  it('steals lock with { steal: true } when held lock heartbeat is stale (>45s)', async () => {
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-stealer' });
    mockLocks.holdLock('vault_sync_lock:vault-abc');

    // Other tab heartbeat is stale (progressed 50s ago, >45s threshold)
    const staleHeartbeat = {
      tabId: 'tab-stale',
      acquiredAt: Date.now() - 70_000,
      lastProgressAt: Date.now() - 50_000,
    };
    coordinator.saveHeartbeat('vault-abc', staleHeartbeat);

    let taskRan = false;
    const result = await coordinator.runExclusiveSync('vault-abc', async () => {
      taskRan = true;
      return 'recovered-after-steal';
    });

    expect(taskRan).toBe(true);
    expect(result).toEqual({ status: 'acquired', result: 'recovered-after-steal' });
    expect(mockLocks.requestCalls).toEqual([
      { name: 'vault_sync_lock:vault-abc', options: { ifAvailable: true } },
      { name: 'vault_sync_lock:vault-abc', options: { steal: true } },
    ]);
  });

  it('times out inactivity watchdog after 30s without progress', async () => {
    vi.useFakeTimers();
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-1' });

    let abortObserved = false;
    let abortReason: any = null;

    const syncPromise = coordinator.runExclusiveSync('vault-abc', async ({ signal }) => {
      signal.addEventListener('abort', () => {
        abortObserved = true;
        abortReason = signal.reason;
      });

      // Simulate a hung or long-waiting async operation
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve);
      });
      return 'done';
    });

    // Advance 29 seconds - should not abort yet
    await vi.advanceTimersByTimeAsync(29_000);
    expect(abortObserved).toBe(false);

    // Advance 1 more second (total 30s)
    await vi.advanceTimersByTimeAsync(1_000);
    expect(abortObserved).toBe(true);
    expect(String(abortReason)).toContain('watchdog timed out due to inactivity');

    await syncPromise;
  });

  it('extends watchdog timeout when reportProgress() is called', async () => {
    vi.useFakeTimers();
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-1' });

    let abortObserved = false;

    const syncPromise = coordinator.runExclusiveSync(
      'vault-abc',
      async ({ signal, reportProgress }) => {
        signal.addEventListener('abort', () => {
          abortObserved = true;
        });

        // Step 1: Wait 20 seconds, then report progress
        await vi.advanceTimersByTimeAsync(20_000);
        reportProgress();
        expect(signal.aborted).toBe(false);

        // Step 2: Wait another 20 seconds (40s total from start, 20s from reportProgress)
        await vi.advanceTimersByTimeAsync(20_000);
        reportProgress();
        expect(signal.aborted).toBe(false);

        // Step 3: Now let it idle for 30s
        await vi.advanceTimersByTimeAsync(30_000);
        expect(signal.aborted).toBe(true);
      }
    );

    await syncPromise;
    expect(abortObserved).toBe(true);
  });

  it('aborts on document freeze and window pagehide events', async () => {
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-1' });

    // Test freeze
    let freezeAborted = false;
    await coordinator.runExclusiveSync('vault-abc', async ({ signal }) => {
      signal.addEventListener('abort', () => {
        freezeAborted = true;
      });
      document.dispatchEvent(new Event('freeze'));
      expect(freezeAborted).toBe(true);
      expect(String(signal.reason)).toContain('frozen');
    });

    // Test pagehide
    let pageHideAborted = false;
    await coordinator.runExclusiveSync('vault-abc', async ({ signal }) => {
      signal.addEventListener('abort', () => {
        pageHideAborted = true;
      });
      window.dispatchEvent(new Event('pagehide'));
      expect(pageHideAborted).toBe(true);
      expect(String(signal.reason)).toContain('pagehide');
    });
  });

  it('cleans up heartbeat, timers, and event listeners on completion and on abort', async () => {
    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-clean' });
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    const removeWinSpy = vi.spyOn(window, 'removeEventListener');

    // Case A: normal completion
    await coordinator.runExclusiveSync('vault-clean', async () => {
      // Heartbeat exists during run
      const hb = coordinator.getHeartbeat('vault-clean');
      expect(hb?.tabId).toBe('tab-clean');
      return 'ok';
    });

    // Heartbeat cleaned up after completion
    expect(coordinator.getHeartbeat('vault-clean')).toBeNull();
    expect(removeDocSpy).toHaveBeenCalledWith('freeze', expect.any(Function));
    expect(removeWinSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

    // Case B: on error/abort
    removeDocSpy.mockClear();
    removeWinSpy.mockClear();

    await expect(
      coordinator.runExclusiveSync('vault-clean', async () => {
        throw new Error('Task failed deliberately');
      })
    ).rejects.toThrow('Task failed deliberately');

    expect(coordinator.getHeartbeat('vault-clean')).toBeNull();
    expect(removeDocSpy).toHaveBeenCalledWith('freeze', expect.any(Function));
    expect(removeWinSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });

  it('falls back to direct execution with watchdog when navigator.locks is undefined', async () => {
    delete (navigator as any).locks;

    const coordinator = new VaultSyncLockCoordinator({ tabId: 'tab-fallback' });
    let ran = false;

    const result = await coordinator.runExclusiveSync('vault-fallback', async ({ signal }) => {
      ran = true;
      expect(signal.aborted).toBe(false);
      return 'fallback-result';
    });

    expect(ran).toBe(true);
    expect(result).toEqual({ status: 'acquired', result: 'fallback-result' });
    expect(coordinator.getHeartbeat('vault-fallback')).toBeNull();
  });
});
