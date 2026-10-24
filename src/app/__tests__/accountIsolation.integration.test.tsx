import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContext, useEffect, useState, StrictMode } from 'react';

import { bootstrapApplication, resetBootstrapForTesting } from '../bootstrap';
import { DatabaseInitializer } from '../../infrastructure/database/schema/DatabaseInitializer';
import {
  openVaultDatabase,
  setActiveVaultDatabase,
  resetActiveVaultDatabase,
  clearVaultDatabaseCache,
  getActiveVaultDatabase,
  type LunaClairDatabase,
} from '../../infrastructure/database/schema/LunaClairDatabase';
import {
  defaultRegistryDatabase,
  vaultRegistry,
} from '../../infrastructure/database/registry/VaultRegistry';
import { ANONYMOUS_OWNER_SUB } from '../../domain/vault/models/vault.types';
import {
  GoogleAuthService,
  googleAuthService,
} from '../../infrastructure/auth/google/GoogleAuthService';
import { googleDriveClient, GoogleDriveClient } from '../../infrastructure/api/google/GoogleDriveClient';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { ApplicationProvider } from '../providers/ApplicationProvider';
import { ApplicationContext, type ApplicationContextValue } from '../providers/ApplicationContext';
import { SyncEngine } from '../../application/sync/SyncEngine';
import { GoogleDriveSyncTransport } from '../../infrastructure/api/transports/GoogleDriveSyncTransport';
import { DexieSyncStateRepository } from '../../infrastructure/database/repositories/DexieSyncStateRepository';
import { DexieSyncQueueRepository } from '../../infrastructure/database/repositories/DexieSyncQueueRepository';
import { SyncStatusStore } from '../../application/sync/SyncStatusStore';
import { HydrationManager } from '../../infrastructure/sync/HydrationManager';
import { createInfrastructure } from '../bootstrap/createInfrastructure';
import { createSyncStateKey } from '../../domain/sync/utils/syncIdentity';
import type { SessionCredentials, SyncMutation } from '../../domain/sync/models/sync.types';
import type { GoogleAuthSession } from '../../domain/auth/models/auth.types';
import type { SyncReconciler } from '../../domain/sync/services/SyncReconciler';
import { VaultSyncLockCoordinator } from '../../application/sync/locks/VaultSyncLockCoordinator';

function createDeferred<T = any>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value?: any) => resolve(value),
    reject,
  };
}
const deferred = createDeferred;

describe('Account & Vault Isolation Integration Suite (Group 1)', () => {
  beforeEach(async () => {
    resetBootstrapForTesting();
    DatabaseInitializer.resetForTesting();
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    await googleAuthService.logout();
    localStorage.clear();
    await defaultRegistryDatabase.vaults.clear();
  });

  afterEach(async () => {
    resetBootstrapForTesting();
    DatabaseInitializer.resetForTesting();
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    await googleAuthService.logout();
    localStorage.clear();
    await defaultRegistryDatabase.vaults.clear();
    vi.restoreAllMocks();
  });

  describe('1. Cold startup vault resolution & promotion', () => {
    it('resolves and opens the physical database mapped to authenticated sub from localStorage', async () => {
      const authSession: GoogleAuthSession = {
        user: {
          sub: 'user-abc',
          email: 'user-abc@lunaclair.dev',
          name: 'User ABC',
        },
        tokens: {
          accessToken: 'access-token-abc',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-token-abc',
        },
      };

      // Pre-provision existing physical database for user-abc in registry
      const existingDbName = 'lc_vault_user_abc_physical';
      await defaultRegistryDatabase.vaults.put({
        ownerSub: 'user-abc',
        physicalDbName: existingDbName,
        createdAt: 1000,
        lastActiveAt: 1000,
      });

      // Write session into localStorage to simulate pre-existing authenticated session
      localStorage.setItem(STORAGE_KEYS.auth.googleSession, JSON.stringify(authSession));

      // Reset in-memory session on singleton so it re-reads from storage
      (googleAuthService as any).session = null;

      await bootstrapApplication();

      const activeDb = getActiveVaultDatabase();
      expect(activeDb.name).toBe(existingDbName);

      const resolvedPointer = await vaultRegistry.getActiveVault('user-abc');
      expect(resolvedPointer.physicalDbName).toBe(existingDbName);
      expect(resolvedPointer.ownerSub).toBe('user-abc');

      // Ensure it did not open or fall back to an anonymous vault
      const anonPointer = await defaultRegistryDatabase.vaults.get(ANONYMOUS_OWNER_SUB);
      expect(anonPointer).toBeUndefined();
    });

    it('opens ANONYMOUS vault on fresh startup with no authenticated session in storage', async () => {
      localStorage.clear();
      (googleAuthService as any).session = null;

      await bootstrapApplication();

      const activeDb = getActiveVaultDatabase();
      const anonPointer = await vaultRegistry.getActiveVault();

      expect(anonPointer.ownerSub).toBe(ANONYMOUS_OWNER_SUB);
      expect(activeDb.name).toBe(anonPointer.physicalDbName);
    });

    it('first-login promoteAnonymousVault rekeys ANONYMOUS to the user sub without data loss', async () => {
      localStorage.clear();
      (googleAuthService as any).session = null;

      await bootstrapApplication();
      const initialDb = getActiveVaultDatabase();
      const anonVault = await vaultRegistry.getActiveVault();
      expect(anonVault.ownerSub).toBe(ANONYMOUS_OWNER_SUB);

      // Seed local data in the anonymous database via repository
      const infra = createInfrastructure(undefined, initialDb);
      const createdMat = await infra.repositories.library.createMaterial({
        title: 'Preserved Anonymous Note',
        description: 'Testing vault promotion zero-data-loss',
      });

      // User logs in for the first time: promote anonymous vault
      const promoResult = await vaultRegistry.promoteAnonymousVault('user-new-sub');
      expect(promoResult.pointer.ownerSub).toBe('user-new-sub');
      expect(promoResult.collisionFromAnonDb).toBeUndefined();
      // Zero-copy guarantee: physical database name remains identical
      expect(promoResult.pointer.physicalDbName).toBe(anonVault.physicalDbName);

      // Verify the anonymous row is gone from the registry
      const anonCheck = await defaultRegistryDatabase.vaults.get(ANONYMOUS_OWNER_SUB);
      expect(anonCheck).toBeUndefined();

      // Verify data is still intact in the database
      const preservedMat = await initialDb.materials.get(createdMat.id);
      expect(preservedMat).toBeDefined();
      expect(preservedMat?.title).toBe('Preserved Anonymous Note');
    });
  });

  describe('2. Mounted application account transition (User A -> disconnect -> User B)', () => {
    it('transitions active vault, clears queryClient cache, and isolates repository writes', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const contextRef = { current: null as ApplicationContextValue | null };

      function TestApp() {
        const app = useContext(ApplicationContext);
        useEffect(() => {
          contextRef.current = app;
        }, [app]);
        return (
          <div>
            <div data-testid="db-name">{app?.infrastructure.db.name}</div>
          </div>
        );
      }

      // Step 1: User A is logged in
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-user-a', email: 'a@lunaclair.dev', name: 'User A' },
        tokens: { accessToken: 'token-a', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-a' },
      };
      (googleAuthService as any).session = sessionA;
      (googleAuthService as any).status = 'authenticated';
      localStorage.setItem(STORAGE_KEYS.auth.googleSession, JSON.stringify(sessionA));

      // Resolve User A's vault and set as active DB for initial mount
      const vaultA = await vaultRegistry.getActiveVault('sub-user-a');
      const dbA = openVaultDatabase(vaultA.physicalDbName);
      setActiveVaultDatabase(dbA);
      await DatabaseInitializer.initialize(dbA);

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <TestApp />
          </ApplicationProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
      expect(contextRef.current?.infrastructure.db.name).toBe(vaultA.physicalDbName);

      // Populate queryClient cache as User A
      queryClient.setQueryData(['cached-profile', 'sub-user-a'], { secretNote: 'user-a-sensitive' });
      expect(queryClient.getQueryData(['cached-profile', 'sub-user-a'])).toBeDefined();

      // Write data into User A's physical database via repository
      const createdMatA = await contextRef.current!.repositories.library.createMaterial({
        title: 'User A Secret Notebook',
        description: 'Classified material',
      });
      const inDbA = await dbA.materials.get(createdMatA.id);
      expect(inDbA).toBeDefined();
      expect(inDbA?.title).toBe('User A Secret Notebook');

      // Step 2: User A disconnects (logout) - under Requirement 3, local library remains open
      const anonVault = await vaultRegistry.getActiveVault();
      await googleAuthService.logout();

      expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
      expect(contextRef.current?.infrastructure.db.name).toBe(vaultA.physicalDbName);

      // Under Requirement 4: Explicit action to switch to separate local-only library
      await act(async () => {
        await (contextRef.current as any).switchActiveLibrary(ANONYMOUS_OWNER_SUB);
      });

      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(anonVault.physicalDbName);
        expect(contextRef.current?.infrastructure.db.name).toBe(anonVault.physicalDbName);
      });

      // Verify queryClient was cleared: User A's cache must not leak
      expect(queryClient.getQueryData(['cached-profile', 'sub-user-a'])).toBeUndefined();

      // Guest writes data
      const guestMat = await contextRef.current!.repositories.library.createMaterial({
        title: 'Guest Note',
        description: 'Anonymous note',
      });

      // Verify guest data did NOT land in User A's database
      const leakedIntoA = await dbA.materials.get(guestMat.id);
      expect(leakedIntoA).toBeUndefined();

      // Step 3: User B logs in
      const sessionB: GoogleAuthSession = {
        user: { sub: 'sub-user-b', email: 'b@lunaclair.dev', name: 'User B' },
        tokens: { accessToken: 'token-b', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-b' },
      };

      const vaultB = await vaultRegistry.getActiveVault('sub-user-b');
      (googleAuthService as any).session = sessionB;
      (googleAuthService as any).status = 'authenticated';
      (googleAuthService as any).sessionGeneration++;
      localStorage.setItem(STORAGE_KEYS.auth.googleSession, JSON.stringify(sessionB));
      (googleAuthService as any).notifyListeners(sessionB);

      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultB.physicalDbName);
        expect(contextRef.current?.infrastructure.db.name).toBe(vaultB.physicalDbName);
      });

      expect(vaultB.physicalDbName).not.toBe(vaultA.physicalDbName);

      // User B writes data
      const createdMatB = await contextRef.current!.repositories.library.createMaterial({
        title: 'User B Workspace Material',
        description: 'B only',
      });

      const dbB = openVaultDatabase(vaultB.physicalDbName);
      const inDbB = await dbB.materials.get(createdMatB.id);
      expect(inDbB).toBeDefined();
      expect(inDbB?.title).toBe('User B Workspace Material');

      // User B cannot see User A's material, and User A cannot see User B's material
      const userAInB = await dbB.materials.get(createdMatA.id);
      expect(userAInB).toBeUndefined();
      const userBInA = await dbA.materials.get(createdMatB.id);
      expect(userBInA).toBeUndefined();

      // Step 4: Verify GoogleDriveSyncTransport is bound to current active vault (User B), not fallback
      const transportPullSpy = vi.spyOn(GoogleDriveSyncTransport.prototype, 'pull');
      transportPullSpy.mockResolvedValueOnce({
        newCursor: 10,
        hasMore: false,
        changes: [],
      });

      await contextRef.current!.infrastructure.transports.sync.pull(
        { userId: 'sub-user-b', deviceId: 'dev-1', token: 'token-b' },
        0,
      );

      expect(transportPullSpy).toHaveBeenCalledTimes(1);
      // Verify the transport instance's db was User B's active physical database
      const boundDb = (transportPullSpy.mock.instances[0] as any).db;
      expect(boundDb.name).toBe(vaultB.physicalDbName);
      expect(boundDb.name).not.toBe('lunaclair-db');

      rendered.unmount();
    });
  });

  describe('3. Pending refresh across account replacement', () => {
    it('prevents stale refresh completion from overwriting User B session or tokens', async () => {
      const deferredFetchA = createDeferred<Response>();
      const customFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/auth/google/refresh')) {
          return deferredFetchA.promise;
        }
        return Promise.resolve(new Response('{}'));
      });

      const authService = new GoogleAuthService({
        clientId: 'test-client',
        customFetch: customFetch as unknown as typeof fetch,
      });

      // User A starts logged in with expired token
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'expired-token-a',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-a',
        },
      };
      (authService as any).session = sessionA;
      (authService as any).status = 'authenticated';
      (authService as any).writeSessionToStorage(sessionA);

      // User A initiates refresh
      const pendingRefreshA = authService.getValidAccessToken(true);

      // User A logs out and User B logs in BEFORE fetch resolves
      await authService.logout();

      const sessionB: GoogleAuthSession = {
        user: { sub: 'sub-b', email: 'b@example.com', name: 'User B' },
        tokens: {
          accessToken: 'valid-token-b',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-b',
        },
      };
      (authService as any).session = sessionB;
      (authService as any).status = 'authenticated';
      (authService as any).sessionGeneration++;
      (authService as any).writeSessionToStorage(sessionB);

      // User B calls getValidAccessToken(): MUST NOT await User A's pending refresh
      const tokenB = await authService.getValidAccessToken();
      expect(tokenB).toBe('valid-token-b');

      // Now User A's pending refresh resolves with User A's new tokens
      deferredFetchA.resolve(
        new Response(
          JSON.stringify({
            accessToken: 'late-refreshed-token-a',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // Await User A's refresh settlement - must reject because session changed to User B
      await expect(pendingRefreshA).rejects.toThrow(
        /Token refresh aborted: session identity changed during refresh/,
      );

      // Verify User B's session and tokens were NOT overwritten
      const currentSession = authService.getSession();
      expect(currentSession).toBeDefined();
      expect(currentSession?.user.sub).toBe('sub-b');
      expect(currentSession?.tokens.accessToken).toBe('valid-token-b');
      expect(authService.getStatus()).toBe('authenticated');
    });

    it('rejecting stale refresh with 401 / invalid_grant does NOT log User B out', async () => {
      const deferredFetchA = createDeferred<Response>();
      const customFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/auth/google/refresh')) {
          return deferredFetchA.promise;
        }
        return Promise.resolve(new Response('{}'));
      });

      const authService = new GoogleAuthService({
        clientId: 'test-client',
        customFetch: customFetch as unknown as typeof fetch,
      });

      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'expired-token-a',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-a',
        },
      };
      (authService as any).session = sessionA;
      (authService as any).status = 'authenticated';
      (authService as any).writeSessionToStorage(sessionA);

      // User A initiates refresh
      const pendingRefreshA = authService.getValidAccessToken(true);

      // User A logs out and User B logs in
      await authService.logout();

      const sessionB: GoogleAuthSession = {
        user: { sub: 'sub-b', email: 'b@example.com', name: 'User B' },
        tokens: {
          accessToken: 'token-b',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-b',
        },
      };
      (authService as any).session = sessionB;
      (authService as any).status = 'authenticated';
      (authService as any).sessionGeneration++;
      (authService as any).writeSessionToStorage(sessionB);

      // User A's refresh returns 401 invalid_grant
      deferredFetchA.resolve(
        new Response(
          JSON.stringify({ error: 'invalid_grant', message: 'Token revoked' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // Await User A's rejection
      await expect(pendingRefreshA).rejects.toThrow();

      // User B must remain authenticated and logged in!
      expect(authService.getStatus()).toBe('authenticated');
      expect(authService.getSession()?.user.sub).toBe('sub-b');
      expect(authService.getSession()?.tokens.accessToken).toBe('token-b');
    });
  });

  describe('4. Same-account token refresh state preservation', () => {
    it('retains Application graph singleton and in-memory state on same-account refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const appRef = { current: null as ApplicationContextValue | null };

      function TestApp() {
        const app = useContext(ApplicationContext);
        useEffect(() => {
          appRef.current = app;
        }, [app]);
        return <div data-testid="app-ready">Ready</div>;
      }

      const initialSession: GoogleAuthSession = {
        user: { sub: 'user-stable', email: 'stable@example.com', name: 'Stable User' },
        tokens: {
          accessToken: 'access-token-1',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-refresh-1',
        },
      };
      (googleAuthService as any).session = initialSession;
      (googleAuthService as any).status = 'authenticated';
      localStorage.setItem(STORAGE_KEYS.auth.googleSession, JSON.stringify(initialSession));

      const vault = await vaultRegistry.getActiveVault('user-stable');
      const db = openVaultDatabase(vault.physicalDbName);
      setActiveVaultDatabase(db);
      await DatabaseInitializer.initialize(db);

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <TestApp />
          </ApplicationProvider>
        </QueryClientProvider>,
      );

      expect(appRef.current).not.toBeNull();
      const firstAppSingleton = appRef.current;

      // Seed queryClient with user data to verify it is NOT cleared
      queryClient.setQueryData(['stable-data'], { value: 42 });

      // Simulate token refresh for the same user (sub unchanged, new token & expiresAt)
      const refreshedSession: GoogleAuthSession = {
        user: { sub: 'user-stable', email: 'stable@example.com', name: 'Stable User' },
        tokens: {
          accessToken: 'access-token-2-refreshed',
          expiresAt: Date.now() + 7200000,
          sealedRefreshToken: 'sealed-refresh-1',
        },
      };

      await act(async () => {
        (googleAuthService as any).session = refreshedSession;
        (googleAuthService as any).writeSessionToStorage(refreshedSession);
        (googleAuthService as any).notifyListeners(refreshedSession);
      });

      // The application graph instance MUST be the exact same singleton
      expect(appRef.current).toBe(firstAppSingleton);
      expect(appRef.current?.infrastructure.db).toBe(firstAppSingleton?.infrastructure.db);

      // The cache MUST NOT have been cleared
      expect(queryClient.getQueryData(['stable-data'])).toEqual({ value: 42 });

      rendered.unmount();
    });
  });

  describe('5. Co-located SyncEngine and GoogleDriveSyncTransport state preservation', () => {
    it('preserves pageToken and appliedFileIds in syncState when pullUntilCaughtUp saves cursor', async () => {
      const testDbName = 'test_sync_engine_isolation';
      const db = openVaultDatabase(testDbName);
      await db.open();

      const stateRepo = new DexieSyncStateRepository(db);
      const queueRepo = new DexieSyncQueueRepository(db);
      const statusStore = new SyncStatusStore();

      const credentials: SessionCredentials = {
        userId: 'sync-user-1',
        deviceId: 'dev-sync-1',
        token: 'token-sync-1',
      };
      const stateKey = createSyncStateKey(credentials.userId, credentials.deviceId);

      // Transport simulates GoogleDriveSyncTransport.pull updating pageToken & appliedFileIds in syncState
      const mockTransport = {
        push: vi.fn().mockResolvedValue({ accepted: [], conflicts: [], rejected: [] }),
        pull: vi.fn().mockImplementation(async () => {
          const fresh = await stateRepo.getSyncState(stateKey);
          await stateRepo.saveSyncState({
            ...fresh,
            key: stateKey,
            userId: credentials.userId,
            deviceId: credentials.deviceId,
            lastServerCursor: fresh?.lastServerCursor ?? 0,
            pageToken: 'saved-page-token-abc',
            appliedFileIds: ['file-101', 'file-102'],
          });
          return {
            newCursor: 50,
            hasMore: false,
            changes: [],
          };
        }),
      };

      const mockReconciler: SyncReconciler = {
        reconcilePullBatch: vi.fn().mockResolvedValue({
          appliedCount: 0,
          conflictCount: 0,
          touchedEntities: [],
        }),
        applyPushResult: vi.fn().mockResolvedValue({
          appliedCount: 0,
          conflictCount: 0,
          touchedEntities: [],
        }),
      };

      const mockLockCoordinator = {
        runExclusiveSync: vi.fn().mockImplementation(async (_userId, fn) => {
          await fn({
            signal: new AbortController().signal,
            reportProgress: () => {},
          });
          return { status: 'acquired' };
        }),
        isSyncRunning: vi.fn().mockReturnValue(false),
      } as unknown as VaultSyncLockCoordinator;

      const engine = new SyncEngine({
        transport: mockTransport as any,
        stateRepo,
        queueRepo,
        reconciler: mockReconciler,
        lockCoordinator: mockLockCoordinator,
        statusStore,
      });

      await engine.sync(credentials);

      // Verify that pullUntilCaughtUp did NOT overwrite pageToken and appliedFileIds
      const finalState = await stateRepo.getSyncState(stateKey);
      expect(finalState).toBeDefined();
      expect(finalState?.lastServerCursor).toBe(50);
      expect(finalState?.pageToken).toBe('saved-page-token-abc');
      expect(finalState?.appliedFileIds).toEqual(['file-101', 'file-102']);

      await db.delete();
    });
  });

  describe('6. Account crossover probe & held in-flight request protection', () => {
    it('prevents held in-flight push from User A from uploading with User B token upon account switch', async () => {
      const dbA = openVaultDatabase(`group1-review-A-${crypto.randomUUID()}`);
      const dbB = openVaultDatabase(`group1-review-B-${crypto.randomUUID()}`);
      await dbA.open();
      await dbB.open();

      const session = (sub: string): GoogleAuthSession => ({
        user: { sub, email: `${sub}@example.invalid`, name: sub },
        tokens: {
          accessToken: `FAKE-${sub}`,
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: `SEALED-${sub}`,
        },
      });

      const releaseDeferred = createDeferred<void>();
      const uploads: Array<{ mutationOwner?: unknown; accessToken?: string }> = [];

      const uploadSpy = vi
        .spyOn(googleDriveClient as any, 'uploadCompressedJson')
        .mockImplementation((...args: any[]) => {
          const [, payload, , accessToken] = args;
          uploads.push({
            mutationOwner: payload?.mutations?.[0]?.payload?.owner,
            accessToken,
          });
          return Promise.resolve({ id: 'FAKE-upload-id' });
        });

      try {
        // Step 1: User A is logged in with active vault dbA
        (googleAuthService as any).session = session('A');
        (googleAuthService as any).status = 'authenticated';
        setActiveVaultDatabase(dbA);

        const runtimeA = createInfrastructure(undefined, dbA);
        const credentialsA = await runtimeA.providers.credentials.getCredentials();
        expect(credentialsA).not.toBeNull();
        const credsA = credentialsA!;

        // Step 2: Start a push from runtime A held at async boundary
        const pushPromise = (async () => {
          await releaseDeferred.promise;
          return runtimeA.transports.sync.push(credsA, {
            deviceId: credsA.deviceId,
            mutations: [
              {
                clientMutationId: 'A-mutation',
                entityType: 'highlight',
                entityId: 'A-note',
                operation: 'UPSERT',
                clientTimestamp: new Date().toISOString(),
                payload: { id: 'A-note', owner: 'A' },
              },
            ],
          });
        })();

        // Step 3: In the meantime, switch to User B (logout A, login B, create runtime B)
        await googleAuthService.logout();
        (googleAuthService as any).session = session('B');
        (googleAuthService as any).status = 'authenticated';
        (googleAuthService as any).sessionGeneration++;
        setActiveVaultDatabase(dbB);
        const runtimeB = createInfrastructure(undefined, dbB);
        expect(runtimeB).toBeDefined();

        // Step 4: Release the deferred promise on runtime A's push
        releaseDeferred.resolve();

        // Step 5: Assert that runtime A's push fails with an account/session mismatch error
        await expect(pushPromise).rejects.toThrow(/(Session mismatch|Account mismatch|Runtime identity mismatch|disposed|unauthenticated)/i);

        // Assert uploads list must NOT contain User A's payload with User B's token
        const crossoverUpload = uploads.find(
          (u) => u.mutationOwner === 'A' && u.accessToken === 'FAKE-B',
        );
        expect(crossoverUpload).toBeUndefined();
        expect(uploads).toHaveLength(0);
      } finally {
        uploadSpy.mockRestore();
        await googleAuthService.logout();
        dbA.close();
        dbB.close();
        await dbA.delete();
        await dbB.delete();
      }
    });

    it('prevents held Drive 401 retry from acquiring User B token or proceeding after account switch', async () => {
      const dbA = openVaultDatabase(`group1-401-A-${crypto.randomUUID()}`);
      await dbA.open();

      const sessionA: GoogleAuthSession = {
        user: { sub: 'user-401-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'expired-token-a',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-a',
        },
      };
      (googleAuthService as any).session = sessionA;
      (googleAuthService as any).status = 'authenticated';

      const deferredRefresh = createDeferred<string>();
      const customFetch = vi.fn();
      let callCount = 0;

      customFetch.mockImplementation(async (url: string) => {
        callCount++;
        if (url.includes('/files')) {
          // First call: initial request with User A's expired token -> return 401
          if (callCount === 1) {
            return new Response(JSON.stringify({ error: { code: 401, message: 'Unauthorized' } }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          // Subsequent calls: return success if retry occurs
          return new Response(JSON.stringify({ files: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}');
      });

      const driveClientA = new GoogleDriveClient({
        fetchFn: customFetch as unknown as typeof fetch,
        baseDelayMs: 0,
      });

      const transportA = new GoogleDriveSyncTransport({
        db: dbA,
        stateRepo: new DexieSyncStateRepository(dbA),
        driveClient: driveClientA,
        expectedSub: 'user-401-a',
        authService: googleAuthService,
        onTokenExpired: async () => {
          // Wait on the held deferred refresh
          await deferredRefresh.promise;
          return (googleAuthService as any).getValidAccessToken(true, 'user-401-a');
        },
      });

      const credentialsA: SessionCredentials = {
        userId: 'user-401-a',
        deviceId: 'device-401-a',
        token: 'expired-token-a',
      };

      // User A initiates pull -> triggers 401 -> triggers held onTokenExpired
      const pullPromise = transportA.pull(credentialsA, 0);

      // In the meantime, User B logs in
      const sessionB: GoogleAuthSession = {
        user: { sub: 'user-401-b', email: 'b@example.com', name: 'User B' },
        tokens: {
          accessToken: 'valid-token-b',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'sealed-b',
        },
      };
      await googleAuthService.logout();
      (googleAuthService as any).session = sessionB;
      (googleAuthService as any).status = 'authenticated';
      (googleAuthService as any).sessionGeneration++;

      // Now release the held onTokenExpired
      deferredRefresh.resolve('user-a-late-token');

      // User A's 401 retry must reject due to session mismatch with User B!
      await expect(pullPromise).rejects.toThrow();

      // Ensure that NO request was sent to Drive with User B's token 'valid-token-b'
      const callsWithTokenB = customFetch.mock.calls.filter((call) => {
        const headers = call[1]?.headers as Record<string, string> | undefined;
        return headers?.Authorization?.includes('valid-token-b');
      });
      expect(callsWithTokenB).toHaveLength(0);

      dbA.close();
      await dbA.delete();
    });
  });

  describe('7. Rapid account transitions & error recovery', () => {
    it('handles rapid A -> B -> A transitions settling on A with correct physical database and no crossover writes', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const contextRef = { current: null as ApplicationContextValue | null };

      function TestApp() {
        const app = useContext(ApplicationContext);
        useEffect(() => {
          contextRef.current = app;
        }, [app]);
        return (
          <div>
            <div data-testid="db-name">{app?.infrastructure.db.name}</div>
          </div>
        );
      }

      const sessionA: GoogleAuthSession = {
        user: { sub: 'rapid-user-a', email: 'a@lunaclair.dev', name: 'User A' },
        tokens: { accessToken: 'token-a', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-a' },
      };
      const sessionB: GoogleAuthSession = {
        user: { sub: 'rapid-user-b', email: 'b@lunaclair.dev', name: 'User B' },
        tokens: { accessToken: 'token-b', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-b' },
      };

      const vaultA = await vaultRegistry.getActiveVault('rapid-user-a');
      const vaultB = await vaultRegistry.getActiveVault('rapid-user-b');
      const dbA = openVaultDatabase(vaultA.physicalDbName);
      const dbB = openVaultDatabase(vaultB.physicalDbName);
      await DatabaseInitializer.initialize(dbA);
      await DatabaseInitializer.initialize(dbB);
      setActiveVaultDatabase(dbA);

      (googleAuthService as any).session = sessionA;
      (googleAuthService as any).status = 'authenticated';
      localStorage.setItem(STORAGE_KEYS.auth.googleSession, JSON.stringify(sessionA));

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <TestApp />
          </ApplicationProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
      });

      // Dispatch rapid account transitions: A -> B -> A
      await act(async () => {
        (googleAuthService as any).session = sessionB;
        (googleAuthService as any).notifyListeners(sessionB);

        (googleAuthService as any).session = sessionA;
        (googleAuthService as any).notifyListeners(sessionA);
        await new Promise((r) => setTimeout(r, 50));
      });

      // Verify final mounted state is User A
      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
        expect(contextRef.current?.infrastructure.db.name).toBe(vaultA.physicalDbName);
      });
      expect(getActiveVaultDatabase().name).toBe(vaultA.physicalDbName);

      // Perform repository write and verify it lands exclusively in dbA, not dbB
      const createdMat = await contextRef.current!.repositories.library.createMaterial({
        title: 'Rapid Final Material',
        description: 'Belongs strictly to User A',
      });

      const inA = await dbA.materials.get(createdMat.id);
      expect(inA).toBeDefined();
      expect(inA?.title).toBe('Rapid Final Material');

      const inB = await dbB.materials.get(createdMat.id);
      expect(inB).toBeUndefined();
      const countB = await dbB.materials.count();
      expect(countB).toBe(0);

      rendered.unmount();
    });

    it('recovers from transition error when getActiveVault throws, allowing subsequent retry without currentSubRef blocking', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const contextRef = { current: null as ApplicationContextValue | null };

      function TestApp() {
        const app = useContext(ApplicationContext);
        useEffect(() => {
          contextRef.current = app;
        }, [app]);
        return (
          <div>
            <div data-testid="db-name">{app?.infrastructure.db.name}</div>
          </div>
        );
      }

      const sessionA: GoogleAuthSession = {
        user: { sub: 'user-safe-a', email: 'a@example.com', name: 'User A' },
        tokens: { accessToken: 'token-a', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-a' },
      };
      const sessionB: GoogleAuthSession = {
        user: { sub: 'user-retry-b', email: 'b@example.com', name: 'User B' },
        tokens: { accessToken: 'token-b', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-b' },
      };

      const vaultA = await vaultRegistry.getActiveVault('user-safe-a');
      const vaultB = await vaultRegistry.getActiveVault('user-retry-b');
      const dbA = openVaultDatabase(vaultA.physicalDbName);
      const dbB = openVaultDatabase(vaultB.physicalDbName);
      await DatabaseInitializer.initialize(dbA);
      await DatabaseInitializer.initialize(dbB);
      setActiveVaultDatabase(dbA);

      (googleAuthService as any).session = sessionA;
      (googleAuthService as any).status = 'authenticated';

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <TestApp />
          </ApplicationProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
      });

      // Mock getActiveVault to throw once for User B
      const originalGetActiveVault = vaultRegistry.getActiveVault.bind(vaultRegistry);
      const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault');
      getActiveVaultSpy.mockRejectedValueOnce(new Error('Simulated transient vault resolution failure'));

      // First transition attempt to User B (fails)
      await act(async () => {
        (googleAuthService as any).session = sessionB;
        (googleAuthService as any).notifyListeners(sessionB);
      });

      // App renders error barrier with retry button, keeping User A's workspace from remaining editable as User B
      await waitFor(() => {
        expect(screen.getByTestId('vault-transition-error')).toBeInTheDocument();
      });

      // Now click retry on the transition error barrier (succeeds)
      getActiveVaultSpy.mockImplementation(originalGetActiveVault);
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      // Successful transition to User B without being blocked by a stale currentSubRef
      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultB.physicalDbName);
        expect(contextRef.current?.infrastructure.db.name).toBe(vaultB.physicalDbName);
      });

      rendered.unmount();
    });
  });

  describe('8. Child component remount & state isolation', () => {
    it('remounts child components on account transition, dropping unpersisted local state', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      function StatefulEditor() {
        const [draft, setDraft] = useState('');
        const app = useContext(ApplicationContext);
        return (
          <div>
            <div data-testid="db-name">{app?.infrastructure.db.name}</div>
            <input
              data-testid="local-draft-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
        );
      }

      const sessionA: GoogleAuthSession = {
        user: { sub: 'user-remount-a', email: 'a@example.com', name: 'User A' },
        tokens: { accessToken: 'token-a', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-a' },
      };
      const sessionB: GoogleAuthSession = {
        user: { sub: 'user-remount-b', email: 'b@example.com', name: 'User B' },
        tokens: { accessToken: 'token-b', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-b' },
      };

      const vaultA = await vaultRegistry.getActiveVault('user-remount-a');
      const vaultB = await vaultRegistry.getActiveVault('user-remount-b');
      const dbA = openVaultDatabase(vaultA.physicalDbName);
      const dbB = openVaultDatabase(vaultB.physicalDbName);
      await DatabaseInitializer.initialize(dbA);
      await DatabaseInitializer.initialize(dbB);
      setActiveVaultDatabase(dbA);

      (googleAuthService as any).session = sessionA;
      (googleAuthService as any).status = 'authenticated';

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <StatefulEditor />
          </ApplicationProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultA.physicalDbName);
      });

      // User A enters unpersisted draft text
      const input = screen.getByTestId('local-draft-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'User A unpersisted secret notes' } });
      expect(input.value).toBe('User A unpersisted secret notes');

      // User switches to User B
      await act(async () => {
        (googleAuthService as any).session = sessionB;
        (googleAuthService as any).notifyListeners(sessionB);
      });

      // Provider transitions active vault to User B
      await waitFor(() => {
        expect(screen.getByTestId('db-name')).toHaveTextContent(vaultB.physicalDbName);
      });

      // The child component has remounted due to key change: unpersisted draft is cleared!
      const remountedInput = screen.getByTestId('local-draft-input') as HTMLInputElement;
      expect(remountedInput.value).toBe('');

      rendered.unmount();
    });
  });

  describe('9. Parent review probes permanent regressions', () => {
    it('Probe 1: in-flight push with passed signal rejects on transport dispose and does not acknowledge or persist file', async () => {
      const db = openVaultDatabase(`probe1-test-${crypto.randomUUID()}`);
      await db.open();
      try {
        const repo = new DexieSyncStateRepository(db);
        let signalPassed = false;
        const started = deferred();
        const uploaded = deferred();

        const transport = new GoogleDriveSyncTransport({
          db,
          stateRepo: repo,
          authService: { getValidAccessToken: async () => 'FAKE-A' } as any,
          expectedSub: 'probe-user-a',
          driveClient: {
            uploadCompressedJson: async (...args: any[]) => {
              signalPassed = args.some((arg) => arg instanceof AbortSignal || arg?.signal instanceof AbortSignal);
              started.resolve();
              return uploaded.promise;
            },
          } as any,
        });

        const mutation: SyncMutation = {
          clientMutationId: 'probe1-mutation',
          entityType: 'highlight',
          entityId: 'probe-1',
          operation: 'UPSERT',
          clientTimestamp: '2026-10-21T12:00:00.000Z',
          payload: { id: 'probe-1', owner: 'probe-user-a' },
        };

        const pushPromise = transport.push(
          { userId: 'probe-user-a', deviceId: 'dev-1' },
          { deviceId: 'dev-1', mutations: [mutation] }
        );

        await started.promise;
        expect(signalPassed).toBe(true);

        transport.dispose();
        uploaded.resolve({ id: 'late-upload-file' });

        await expect(pushPromise).rejects.toThrow();

        const state = await repo.getSyncState('probe-user-a:dev-1');
        expect(state?.appliedFileIds ?? []).toEqual([]);
      } finally {
        db.close();
        await db.delete();
      }
    });

    it('held DOWNLOAD returning a pointer after disposal does NOT enqueue pointer or mutate state', async () => {
      const db = openVaultDatabase(`held-download-test-${crypto.randomUUID()}`);
      await db.open();
      try {
        const repo = new DexieSyncStateRepository(db);
        const hydration = new HydrationManager({ db });
        const enqueueSpy = vi.spyOn(hydration, 'enqueuePointer');
        let signalPassed = false;
        const started = deferred();
        const downloaded = deferred();

        const transport = new GoogleDriveSyncTransport({
          db,
          stateRepo: repo,
          authService: { getValidAccessToken: async () => 'FAKE-A' } as any,
          expectedSub: 'download-user-a',
          hydrationManager: hydration,
          driveClient: {
            getStartPageToken: async () => 'start-token',
            listFiles: async () => [
              {
                id: 'pointer-journal-file',
                name: 'journal_1.json.gz',
                appProperties: { type: 'journal', hlc: '1-0-dev', deviceId: 'peer-dev' },
              },
            ],
            downloadCompressedJson: async (...args: any[]) => {
              signalPassed = args.some((arg) => arg instanceof AbortSignal || arg?.signal instanceof AbortSignal);
              started.resolve();
              return downloaded.promise;
            },
          } as any,
        });

        const pullPromise = transport.pull(
          { userId: 'download-user-a', deviceId: 'dev-1' },
          0
        );

        await started.promise;
        expect(signalPassed).toBe(true);

        transport.dispose();
        downloaded.resolve({
          hlc: '1-0-dev',
          deviceId: 'peer-dev',
          createdAt: new Date().toISOString(),
          mutations: [
            {
              entityType: 'pointer',
              entityId: 'share-late-123',
              operation: 'UPSERT',
              clientTimestamp: new Date().toISOString(),
              payload: { originShareId: 'share-late-123', title: 'Late Pointer' },
            },
          ],
        });

        await expect(pullPromise).rejects.toThrow();
        expect(enqueueSpy).not.toHaveBeenCalled();

        const state = await repo.getSyncState('download-user-a:dev-1');
        expect(state?.appliedFileIds ?? []).toEqual([]);
      } finally {
        db.close();
        await db.delete();
      }
    });

    it('Probe 2: anonymous runtime rejects sync push with authenticated User B credentials', async () => {
      const db = openVaultDatabase(`probe2-anon-test-${crypto.randomUUID()}`);
      await db.open();
      try {
        await googleAuthService.logout();
        setActiveVaultDatabase(db);
        const anonymousRuntime = createInfrastructure(undefined, db);

        // Session changes to User B externally
        const sessionB: GoogleAuthSession = {
          user: { sub: 'sub-probe-b', email: 'b@example.com', name: 'User B' },
          tokens: { accessToken: 'token-b', expiresAt: Date.now() + 3600000, sealedRefreshToken: 'sealed-b' },
        };
        (googleAuthService as any).session = sessionB;
        (googleAuthService as any).status = 'authenticated';
        if (typeof (googleAuthService as any).sessionGeneration === 'number') {
          (googleAuthService as any).sessionGeneration++;
        }

        const mutation: SyncMutation = {
          clientMutationId: 'probe2-mutation',
          entityType: 'highlight',
          entityId: 'probe-2',
          operation: 'UPSERT',
          clientTimestamp: '2026-10-21T12:00:00.000Z',
          payload: { id: 'probe-2', owner: 'anonymous' },
        };

        // Calling push on the anonymous runtime with User B credentials must reject
        await expect(
          anonymousRuntime.transports.sync.push(
            { userId: 'sub-probe-b', deviceId: 'device-probe' },
            { deviceId: 'device-probe', mutations: [mutation] }
          )
        ).rejects.toThrow(/Runtime identity mismatch/i);
      } finally {
        await googleAuthService.logout();
        db.close();
        await db.delete();
      }
    });

    it('Probe 3: cancellation during promoteAnonymousVault await does NOT mutate active database', async () => {
      const dbAnon = openVaultDatabase(`probe3-anon-${crypto.randomUUID()}`);
      const dbOther = openVaultDatabase(`probe3-other-${crypto.randomUUID()}`);
      await dbAnon.open();
      await dbOther.open();
      try {
        const promotionStarted = deferred();
        const promotion = deferred();

        const svc = new GoogleAuthService({
          clientId: 'fake',
          storage: { getItem: () => null, setItem() {}, removeItem() {} },
          loadGis: async () => ({
            accounts: {
              oauth2: {
                initCodeClient: (options: any) => ({
                  requestCode: () => { void options.callback({ code: 'probe3-code' }); },
                }),
              },
            },
          }) as any,
          customFetch: async () =>
            new Response(
              JSON.stringify({
                sub: 'probe3-user-a',
                email: 'a@example.com',
                name: 'User A',
                accessToken: 'token-a',
                expiresIn: 3600,
                sealedRefreshToken: 'sealed-a',
              })
            ),
          vaultRegistry: {
            promoteAnonymousVault: async () => {
              promotionStarted.resolve();
              return promotion.promise;
            },
          } as any,
        });

        setActiveVaultDatabase(dbAnon);

        // Start login flow
        const loginPromise = svc.login().catch((err) => err);

        // Wait until promotion has started (awaiting inside exchangeCodeForSession)
        await promotionStarted.promise;

        // While promotion is pending, user logs out and switches active database to dbOther
        await svc.logout();
        setActiveVaultDatabase(dbOther);

        // Release the promotion
        promotion.resolve({
          pointer: { physicalDbName: dbAnon.name, ownerSub: 'probe3-user-a', schemaVersion: 16 },
        });

        await Promise.resolve();
        await Promise.resolve();
        const loginResult = await loginPromise;

        // Login was cancelled
        expect(loginResult).toBeInstanceOf(Error);
        expect(loginResult.message).toMatch(/Login cancelled: session logged out/);

        // Active vault database MUST REMAIN dbOther, NOT reset to dbAnon!
        expect(getActiveVaultDatabase().name).toBe(dbOther.name);
        expect(svc.getSession()).toBeNull();
      } finally {
        dbAnon.close();
        dbOther.close();
        await dbAnon.delete();
        await dbOther.delete();
      }
    });

    it('unmounting ApplicationProvider cleanly disposes the active application graph', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const contextRef = { current: null as ApplicationContextValue | null };
      function TestApp() {
        const app = useContext(ApplicationContext);
        useEffect(() => {
          contextRef.current = app;
        }, [app]);
        return <div>Mounted</div>;
      }

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <ApplicationProvider>
            <TestApp />
          </ApplicationProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(contextRef.current).toBeDefined();
      });

      const appInstance = contextRef.current!;
      const disposeSpy = vi.spyOn(appInstance, 'dispose' as any);

      rendered.unmount();

      await waitFor(() => {
        expect(disposeSpy).toHaveBeenCalled();
      });
    });
  });

  describe('10. React lifecycle, StrictMode replay, same-vault preservation & target upgrade-blocked', () => {
    it('actual StrictMode effect replay leaves the mounted application usable and unmount cleanly disposes', async () => {
      await googleAuthService.logout();
      const db = openVaultDatabase(`strictmode-test-${crypto.randomUUID()}`);
      await db.open();
      setActiveVaultDatabase(db);
      try {
        let app: ApplicationContextValue | null = null;
        function Capture() {
          const value = useContext(ApplicationContext);
          useEffect(() => {
            app = value;
          }, [value]);
          return null;
        }
        const queryClient = new QueryClient();
        const rendered = render(
          <StrictMode>
            <QueryClientProvider client={queryClient}>
              <ApplicationProvider>
                <Capture />
              </ApplicationProvider>
            </QueryClientProvider>
          </StrictMode>
        );

        expect(app).not.toBeNull();
        await expect(app!.useCases.sync.syncEngine.sync(null)).resolves.toEqual({ status: 'standby' });

        const disposeSpy = vi.spyOn(app!, 'dispose');
        rendered.unmount();
        await waitFor(() => {
          expect(disposeSpy).toHaveBeenCalled();
        });
      } finally {
        db.close();
        await db.delete();
      }
    });

    it('same-physical-vault first-login promotion preserves mounted unsaved draft state', async () => {
      await googleAuthService.logout();
      const db = openVaultDatabase(`same-vault-test-${crypto.randomUUID()}`);
      await db.open();
      setActiveVaultDatabase(db);
      try {
        function Draft() {
          const [text, setText] = useState('');
          return <input aria-label="unsaved draft" value={text} onChange={(e) => setText(e.target.value)} />;
        }
        const queryClient = new QueryClient();
        render(
          <QueryClientProvider client={queryClient}>
            <ApplicationProvider>
              <Draft />
            </ApplicationProvider>
          </QueryClientProvider>
        );

        fireEvent.change(screen.getByLabelText('unsaved draft'), {
          target: { value: 'Important unsaved authoring' },
        });
        expect(screen.getByLabelText('unsaved draft')).toHaveValue('Important unsaved authoring');

        const sub = `same-vault-promotion-${crypto.randomUUID()}`;
        await defaultRegistryDatabase.vaults.put({
          ownerSub: sub,
          physicalDbName: db.name,
          createdAt: 0,
          lastActiveAt: 0,
        });

        await act(async () => {
          const session = {
            user: { sub, email: 'fake@example.invalid', name: 'Fake' },
            tokens: {
              accessToken: 'FAKE',
              expiresAt: Date.now() + 3600000,
              sealedRefreshToken: 'SEALED',
            },
          };
          (googleAuthService as any).session = session;
          (googleAuthService as any).status = 'authenticated';
          (googleAuthService as any).sessionGeneration++;
          (googleAuthService as any).notifyListeners(session);
        });

        await waitFor(() => {
          expect(screen.getByLabelText('unsaved draft')).toBeTruthy();
        });
        expect(screen.getByLabelText('unsaved draft')).toHaveValue('Important unsaved authoring');
      } finally {
        db.close();
        await db.delete();
      }
    });

    it('target upgrade-blocked event during pending initialization renders DatabaseReloadScreen before open settles', async () => {
      await googleAuthService.logout();
      const dbA = openVaultDatabase(`upgrade-blocked-a-${crypto.randomUUID()}`);
      await dbA.open();
      setActiveVaultDatabase(dbA);

      const targetSub = `sub-upgrade-blocked-${crypto.randomUUID()}`;
      const targetDbName = `upgrade-blocked-target-${crypto.randomUUID()}`;
      const targetDb = openVaultDatabase(targetDbName);

      // Register the target vault in registry
      await defaultRegistryDatabase.vaults.put({
        ownerSub: targetSub,
        physicalDbName: targetDbName,
        createdAt: 0,
        lastActiveAt: 0,
      });

      // Mock DatabaseInitializer.initialize to simulate pending open that triggers upgrade-blocked
      const initDeferred = deferred<void>();
      const initSpy = vi.spyOn(DatabaseInitializer, 'initialize').mockImplementation(async (db?: LunaClairDatabase) => {
        if (db?.name === targetDbName) {
          // Emit the upgrade-blocked event while initialization remains pending!
          (db as any).notifyReloadRequired('upgrade-blocked');
          await initDeferred.promise;
        }
      });

      try {
        const queryClient = new QueryClient();
        render(
          <QueryClientProvider client={queryClient}>
            <ApplicationProvider>
              <div>User Workspace</div>
            </ApplicationProvider>
          </QueryClientProvider>
        );

        // Trigger transition to targetSub
        await act(async () => {
          const session = {
            user: { sub: targetSub, email: 'blocked@example.invalid', name: 'Blocked User' },
            tokens: {
              accessToken: 'FAKE',
              expiresAt: Date.now() + 3600000,
              sealedRefreshToken: 'SEALED',
            },
          };
          (googleAuthService as any).session = session;
          (googleAuthService as any).status = 'authenticated';
          (googleAuthService as any).sessionGeneration++;
          (googleAuthService as any).notifyListeners(session);
        });

        // DatabaseReloadScreen should render immediately for upgrade-blocked while initialize is still pending!
        await waitFor(() => {
          expect(screen.getByText('Close your other LunaClair tabs')).toBeTruthy();
          expect(screen.getByRole('button', { name: /Reload LunaClair/i })).toBeTruthy();
        });
      } finally {
        initDeferred.resolve();
        initSpy.mockRestore();
        dbA.close();
        targetDb.close();
        await dbA.delete();
        await targetDb.delete();
        await defaultRegistryDatabase.vaults.delete(targetSub);
      }
    });
  });
});
