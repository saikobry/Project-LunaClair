import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, act, waitFor } from '@testing-library/react';
import { useContext, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationProvider } from '../ApplicationProvider';
import { ApplicationContext } from '../ApplicationContext';
import { googleAuthService } from '../../../infrastructure/auth/google/GoogleAuthService';
import { defaultRegistryDatabase, vaultRegistry } from '../../../infrastructure/database/registry/VaultRegistry';
import { DatabaseInitializer } from '../../../infrastructure/database/schema/DatabaseInitializer';
import * as LunaClairDbModule from '../../../infrastructure/database/schema/LunaClairDatabase';
import type { GoogleAuthSession } from '../../../domain/auth/models/auth.types';

describe('ApplicationProvider runtime transition on account switch', () => {
  let queryClient: QueryClient;
  let authListener: ((session: GoogleAuthSession | null) => void) | null = null;
  let currentSession: GoogleAuthSession | null = null;

  beforeEach(async () => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    currentSession = null;
    authListener = null;

    DatabaseInitializer.resetForTesting();
    LunaClairDbModule.resetActiveVaultDatabase();
    LunaClairDbModule.clearVaultDatabaseCache();
    await defaultRegistryDatabase.vaults.clear();

    vi.spyOn(googleAuthService, 'getSession').mockImplementation(() => currentSession);
    vi.spyOn(googleAuthService, 'subscribe').mockImplementation((listener) => {
      authListener = listener;
      return () => {
        authListener = null;
      };
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    queryClient.clear();
    localStorage.clear();
    DatabaseInitializer.resetForTesting();
    LunaClairDbModule.resetActiveVaultDatabase();
    LunaClairDbModule.clearVaultDatabaseCache();
    await defaultRegistryDatabase.vaults.clear();
  });

  function ConsumerComponent({ onValue }: { onValue: (val: any) => void }) {
    const ctx = useContext(ApplicationContext);
    useEffect(() => {
      onValue(ctx);
    }, [ctx, onValue]);
    return null;
  }

  it('supplies stable application graph initially', () => {
    let captured: any = null;
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <ConsumerComponent onValue={(val) => { captured = val; }} />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    expect(captured).not.toBeNull();
    expect(captured.repositories).toBeDefined();
    expect(captured.useCases).toBeDefined();
    expect(captured.infrastructure).toBeDefined();
  });

  it('ignores same-account token refresh without re-creating container state or clearing cache', async () => {
    currentSession = {
      user: { sub: 'user-sub-1', email: 'u1@test.com', name: 'User 1' },
      tokens: { accessToken: 'token-v1', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };

    let renderCount = 0;
    const queryClearSpy = vi.spyOn(queryClient, 'clear');

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <ConsumerComponent onValue={() => {
            renderCount++;
          }} />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    expect(renderCount).toBe(1);

    // Fire token refresh with same sub
    const refreshedSession: GoogleAuthSession = {
      ...currentSession,
      tokens: { accessToken: 'token-v2', expiresAt: Date.now() + 20000, sealedRefreshToken: 'sealed' },
    };
    currentSession = refreshedSession;

    act(() => {
      authListener?.(refreshedSession);
    });

    expect(queryClearSpy).not.toHaveBeenCalled();
    expect(renderCount).toBe(1);
  });

  it('transitions active vault and resets query cache on identity switch', async () => {
    currentSession = {
      user: { sub: 'user-sub-1', email: 'u1@test.com', name: 'User 1' },
      tokens: { accessToken: 'token-1', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };

    let captured: any = null;
    const queryClearSpy = vi.spyOn(queryClient, 'clear');
    const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault');
    const setActiveDbSpy = vi.spyOn(LunaClairDbModule, 'setActiveVaultDatabase');
    const initSpy = vi.spyOn(DatabaseInitializer, 'initialize');

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <ConsumerComponent onValue={(val) => { captured = val; }} />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    const initialValue = captured;
    expect(initialValue).toBeDefined();
    const disposeSpy = vi.spyOn(initialValue.infrastructure, 'dispose');

    // Switch account to user-sub-2
    const newSession: GoogleAuthSession = {
      user: { sub: 'user-sub-2', email: 'u2@test.com', name: 'User 2' },
      tokens: { accessToken: 'token-2', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };
    currentSession = newSession;

    await act(async () => {
      authListener?.(newSession);
    });

    await waitFor(() => {
      expect(getActiveVaultSpy).toHaveBeenCalledWith('user-sub-2');
      expect(initSpy).toHaveBeenCalled();
      expect(setActiveDbSpy).toHaveBeenCalled();
      expect(disposeSpy).toHaveBeenCalled();
      expect(queryClearSpy).toHaveBeenCalled();
      expect(captured).not.toBe(initialValue);
    });
  });

  it('remounts child tree with new key on database switch to drop local state', async () => {
    let unmountCount = 0;
    function StatefulChild() {
      useEffect(() => {
        return () => {
          unmountCount++;
        };
      }, []);
      return <div>Stateful Child</div>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <StatefulChild />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    expect(unmountCount).toBe(0);

    // Switch account to user-sub-2
    const newSession: GoogleAuthSession = {
      user: { sub: 'user-sub-2', email: 'u2@test.com', name: 'User 2' },
      tokens: { accessToken: 'token-2', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };
    currentSession = newSession;

    await act(async () => {
      authListener?.(newSession);
    });

    await waitFor(() => {
      expect(unmountCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not advance currentSubRef on vault transition error, enabling retry', async () => {
    let captured: any = null;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <ConsumerComponent onValue={(val) => { captured = val; }} />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    const initialValue = captured;
    const newSession: GoogleAuthSession = {
      user: { sub: 'user-sub-retry', email: 'retry@test.com', name: 'User Retry' },
      tokens: { accessToken: 'token-retry', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };
    currentSession = newSession;

    // First attempt fails
    vi.spyOn(vaultRegistry, 'getActiveVault').mockRejectedValueOnce(new Error('Vault DB locked'));

    await act(async () => {
      authListener?.(newSession);
    });

    expect(captured).toBe(initialValue);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Second attempt with the SAME newSession succeeds because currentSubRef was not updated to newSession.user.sub
    await act(async () => {
      authListener?.(newSession);
    });

    await waitFor(() => {
      expect(captured).not.toBe(initialValue);
    });
    consoleErrorSpy.mockRestore();
  });

  it('retains active library on disconnect and rebinds on same-owner reconnect without database remount', async () => {
    currentSession = {
      user: { sub: 'user-sub-1', email: 'u1@test.com', name: 'User 1' },
      tokens: { accessToken: 'token-1', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };

    let captured: any = null;
    const queryClearSpy = vi.spyOn(queryClient, 'clear');
    const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault');

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <ConsumerComponent onValue={(val) => { captured = val; }} />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    const initialValue = captured;
    expect(initialValue).toBeDefined();
    const initialDbName = initialValue.infrastructure.db.name;

    // Disconnect: session becomes null
    currentSession = null;

    await act(async () => {
      authListener?.(null);
    });

    // Vault remains open, cache is NOT cleared, same application graph
    expect(getActiveVaultSpy).not.toHaveBeenCalled();
    expect(queryClearSpy).not.toHaveBeenCalled();
    expect(captured.infrastructure.db.name).toBe(initialDbName);

    // Reconnect same user
    const reconnectedSession: GoogleAuthSession = {
      user: { sub: 'user-sub-1', email: 'u1@test.com', name: 'User 1' },
      tokens: { accessToken: 'token-reconnected', expiresAt: Date.now() + 10000, sealedRefreshToken: 'sealed' },
    };
    currentSession = reconnectedSession;

    await act(async () => {
      authListener?.(reconnectedSession);
    });

    // Still same database without remount
    expect(getActiveVaultSpy).not.toHaveBeenCalled();
    expect(queryClearSpy).not.toHaveBeenCalled();
    expect(captured.infrastructure.db.name).toBe(initialDbName);
  });

  it('cancels listener and invalidator when unmounted', () => {
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <div>Child</div>
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    expect(authListener).not.toBeNull();
    unmount();
    expect(authListener).toBeNull();
  });
});
