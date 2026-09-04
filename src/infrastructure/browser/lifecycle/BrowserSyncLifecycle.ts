export interface BrowserSyncLifecycleOptions {
  onTrigger: () => Promise<void> | void;
  intervalMs?: number;
  focusCooldownMs?: number;
}

/**
 * Environment integration that binds browser lifecycle events to synchronization triggers:
 * - `online` event: triggers synchronization when connectivity is restored
 * - `visibilitychange` event: triggers synchronization when the tab becomes visible (with cooldown)
 * - Periodic interval timer: triggers synchronization periodically while tab is visible
 */
export class BrowserSyncLifecycle {
  private readonly onTrigger: () => Promise<void> | void;
  private readonly intervalMs: number;
  private readonly focusCooldownMs: number;
  private cleanupFn: (() => void) | null = null;
  private lastFocusTriggerTime = 0;

  constructor(options: BrowserSyncLifecycleOptions) {
    this.onTrigger = options.onTrigger;
    this.intervalMs = options.intervalMs ?? 60000;
    this.focusCooldownMs = options.focusCooldownMs ?? 10000;
  }

  start(): () => void {
    this.stop();

    const onOnline = () => {
      void this.onTrigger();
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - this.lastFocusTriggerTime > this.focusCooldownMs) {
          this.lastFocusTriggerTime = now;
          void this.onTrigger();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const timerId = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.onTrigger();
      }
    }, this.intervalMs);

    const cleanup = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      clearInterval(timerId);
      this.cleanupFn = null;
    };

    this.cleanupFn = cleanup;
    return cleanup;
  }

  stop(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
    }
  }
}
