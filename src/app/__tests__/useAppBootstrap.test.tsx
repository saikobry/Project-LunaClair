import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const bootstrapApplication = vi.fn();
const onReloadRequired = vi.fn();
const unsubscribe = vi.fn();
const reloadWithFreshServiceWorker = vi.fn();

vi.mock('../bootstrap', () => ({
  bootstrapApplication: (...args: unknown[]) => bootstrapApplication(...args),
}));

vi.mock('../serviceWorkerUpdate', () => ({
  reloadWithFreshServiceWorker: (...args: unknown[]) => reloadWithFreshServiceWorker(...args),
}));

// The real module owns the Dexie singleton; the hook only needs its subscription surface here.
vi.mock('../../infrastructure/database/schema/LunaClairDatabase', () => ({
  db: { onReloadRequired: (listener: unknown) => onReloadRequired(listener) },
}));

import { useAppBootstrap } from '../useAppBootstrap';
import {
  DatabaseReloadRequiredError,
  type DatabaseReloadReason,
} from '../../infrastructure/database/schema/databaseLifecycle';

type ReloadListener = (reason: DatabaseReloadReason) => void;

beforeEach(() => {
  vi.clearAllMocks();
  onReloadRequired.mockReturnValue(unsubscribe);
  bootstrapApplication.mockResolvedValue(undefined);
});

describe('useAppBootstrap', () => {
  it('reports ready once the database bootstrap resolves', async () => {
    const { result } = renderHook(() => useAppBootstrap());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.reloadReason).toBeNull();
  });

  it('turns a database newer than this bundle into a reload state, never a false ready', async () => {
    bootstrapApplication.mockRejectedValue(
      new DatabaseReloadRequiredError('app-updated', 'lunaclair-db'),
    );

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(result.current.reloadReason).toBe('app-updated'));
    expect(result.current.status).toBe('loading');
  });

  it('subscribes before opening, so a blocked upgrade reaches the UI', async () => {
    let listener: ReloadListener | undefined;
    onReloadRequired.mockImplementation((registered: ReloadListener) => {
      listener = registered;
      return unsubscribe;
    });
    // A blocked upgrade never settles `open()` — the promise stays pending, which is why the
    // subscription (not the rejection path) has to carry this case.
    bootstrapApplication.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAppBootstrap());

    expect(onReloadRequired).toHaveBeenCalledTimes(1);
    expect(result.current.reloadReason).toBeNull();

    act(() => {
      listener?.('upgrade-blocked');
    });

    expect(result.current.reloadReason).toBe('upgrade-blocked');
    expect(result.current.status).toBe('loading');
  });

  it('reloads through a fresh service worker when asked', () => {
    const { result } = renderHook(() => useAppBootstrap());

    result.current.requestReload();

    expect(reloadWithFreshServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAppBootstrap());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
