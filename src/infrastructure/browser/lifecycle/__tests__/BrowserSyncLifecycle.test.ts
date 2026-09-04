import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserSyncLifecycle } from '../BrowserSyncLifecycle';

describe('BrowserSyncLifecycle', () => {
  let onTriggerMock: () => void;

  beforeEach(() => {
    onTriggerMock = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('triggers on online event', () => {
    const lifecycle = new BrowserSyncLifecycle({
      onTrigger: () => {
        onTriggerMock();
      },
    });

    const cleanup = lifecycle.start();

    window.dispatchEvent(new Event('online'));
    expect(onTriggerMock).toHaveBeenCalledTimes(1);

    cleanup();
    window.dispatchEvent(new Event('online'));
    expect(onTriggerMock).toHaveBeenCalledTimes(1);
  });

  it('triggers periodically via interval', () => {
    const lifecycle = new BrowserSyncLifecycle({
      onTrigger: () => {
        onTriggerMock();
      },
      intervalMs: 15000,
    });

    const cleanup = lifecycle.start();

    vi.advanceTimersByTime(30000);
    expect(onTriggerMock).toHaveBeenCalledTimes(2);

    cleanup();
    vi.advanceTimersByTime(30000);
    expect(onTriggerMock).toHaveBeenCalledTimes(2);
  });
});
