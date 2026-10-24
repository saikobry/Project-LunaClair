import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useContext, useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dexie from 'dexie';
import { ApplicationProvider } from '../providers/ApplicationProvider';
import { ApplicationContext, type ApplicationContextValue } from '../providers/ApplicationContext';
import { googleAuthService } from '../../infrastructure/auth/google/GoogleAuthService';
import {
  openVaultDatabase,
  setActiveVaultDatabase,
  getActiveVaultDatabase,
  resetActiveVaultDatabase,
  clearVaultDatabaseCache,
  type LunaClairDatabase,
} from '../../infrastructure/database/schema/LunaClairDatabase';
import { defaultRegistryDatabase } from '../../infrastructure/database/registry/VaultRegistry';
import { DatabaseInitializer } from '../../infrastructure/database/schema/DatabaseInitializer';
import { bootstrapApplication, resetBootstrapForTesting } from '../bootstrap';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { ANONYMOUS_OWNER_SUB } from '../../domain/vault/models/vault.types';

describe('Vault Library UX & Sync Controls Integration Suite', () => {
  const createdDbs: LunaClairDatabase[] = [];

  const createTestDb = async (name?: string) => {
    const dbName = name ?? `lc_vault_ux_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const db = openVaultDatabase(dbName);
    createdDbs.push(db);
    await db.open();
    await DatabaseInitializer.initialize(db);
    return db;
  };

  beforeEach(async () => {
    localStorage.clear();
    resetBootstrapForTesting();
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    await googleAuthService.logout();
    await defaultRegistryDatabase.vaults.clear();
  });

  afterEach(async () => {
    cleanup();
    await googleAuthService.logout();
    resetBootstrapForTesting();
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    for (const db of createdDbs.splice(0)) {
      try {
        db.close();
        await Dexie.delete(db.name);
      } catch {
        // cleanup best-effort
      }
    }
    await defaultRegistryDatabase.vaults.clear();
    localStorage.clear();
  });

  it('1. pause aborts in-flight sync cycle safely while retaining outbox queue intact', async () => {
    const db = await createTestDb();
    setActiveVaultDatabase(db);

    const sub = 'user-pause-1';
    await defaultRegistryDatabase.vaults.put({
      ownerSub: sub,
      physicalDbName: db.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    const appRef = { current: null as ApplicationContextValue | null };
    function Capture() {
      const value = useContext(ApplicationContext);
      useEffect(() => {
        appRef.current = value;
      }, [value]);
      return null;
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <Capture />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    // Enqueue an outbox mutation
    await db.syncQueue.add({
      id: 'q-pause-1',
      clientMutationId: 'mut-pause-1',
      entityType: 'document',
      entityId: 'doc-pause-1',
      operation: 'UPSERT',
      clientTimestamp: '2026-10-22T04:00:00.000Z',
      payload: { id: 'doc-pause-1', title: 'Paused Document' },
      status: 'pending',
      createdAt: '2026-10-22T04:00:00.000Z',
      retryCount: 0,
    });

    expect(await db.syncQueue.count()).toBe(1);

    const engine = appRef.current!.useCases.sync.syncEngine;
    engine.pause(sub);

    expect(engine.isPaused(sub)).toBe(true);
    expect(appRef.current!.useCases.sync.syncStatusStore.getState().state).toBe('paused');

    // Calling sync while paused short-circuits to paused and leaves outbox intact
    const syncRes = await engine.sync({ userId: sub, deviceId: 'dev-1' });
    expect(syncRes).toEqual({ status: 'paused' });
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('2. resume with matching owner unpauses and resumes sync; mismatched owner remains paused/standby', async () => {
    const db = await createTestDb();
    setActiveVaultDatabase(db);
    const subA = 'owner-a';
    const subB = 'owner-b';

    await defaultRegistryDatabase.vaults.put({
      ownerSub: subA,
      physicalDbName: db.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    const appRef = { current: null as ApplicationContextValue | null };
    function Capture() {
      const value = useContext(ApplicationContext);
      useEffect(() => {
        appRef.current = value;
      }, [value]);
      return null;
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <Capture />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    const engine = appRef.current!.useCases.sync.syncEngine;
    engine.pause(subA);
    expect(engine.isPaused(subA)).toBe(true);

    // Resume with mismatched owner subB should not unpause subA
    await engine.resume({ userId: subB, deviceId: 'dev-b' }, subA);
    expect(engine.isPaused(subA)).toBe(true);

    // Resume with matching owner subA successfully unpauses
    await engine.resume({ userId: subA, deviceId: 'dev-a' }, subA);
    expect(engine.isPaused(subA)).toBe(false);
  });

  it('3. disconnect Drive terminates authentication and sync but keeps the current local library open and available for local writes', async () => {
    const dbA = await createTestDb();
    setActiveVaultDatabase(dbA);
    const subA = 'account-user-a';

    await defaultRegistryDatabase.vaults.put({
      ownerSub: subA,
      physicalDbName: dbA.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    const appRef = { current: null as ApplicationContextValue | null };
    function AppView() {
      const value = useContext(ApplicationContext);
      const [text, setText] = useState('');
      useEffect(() => {
        appRef.current = value;
      }, [value]);
      return (
        <div>
          <span data-testid="active-db">{value?.infrastructure.db.name}</span>
          <input
            aria-label="draft-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      );
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <AppView />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    // Login as User A
    await act(async () => {
      const session = {
        user: { sub: subA, email: 'usera@example.invalid', name: 'User A' },
        tokens: {
          accessToken: 'TOKEN_A',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'SEALED_A',
        },
      };
      (googleAuthService as any).session = session;
      (googleAuthService as any).status = 'authenticated';
      (googleAuthService as any).sessionGeneration++;
      (googleAuthService as any).notifyListeners(session);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-db').textContent).toBe(dbA.name);
    });

    // Enter unsaved authoring text
    fireEvent.change(screen.getByLabelText('draft-editor'), {
      target: { value: 'User A Unsaved Notes' },
    });
    expect(screen.getByLabelText('draft-editor')).toHaveValue('User A Unsaved Notes');

    // Disconnect (logout)
    await act(async () => {
      await googleAuthService.logout();
    });

    // Under Requirement 3: Same local physical DB remains open, mounted draft is preserved!
    expect(screen.getByTestId('active-db').textContent).toBe(dbA.name);
    expect(screen.getByLabelText('draft-editor')).toHaveValue('User A Unsaved Notes');
    expect(appRef.current?.infrastructure.db.name).toBe(dbA.name);

    // Local writes succeed in the retained local database
    const mat = await appRef.current!.repositories.library.createMaterial({
      title: 'Offline Note in Retained Library',
      description: 'Local write after disconnect',
    });
    const saved = await dbA.materials.get(mat.id);
    expect(saved).toBeDefined();
    expect(saved?.title).toBe('Offline Note in Retained Library');
  });

  it('4. disconnected reload opens the retained user vault rather than falling back to anonymous', async () => {
    const dbA = await createTestDb();
    const subA = 'retained-user-4';

    await defaultRegistryDatabase.vaults.put({
      ownerSub: subA,
      physicalDbName: dbA.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    // Persist active library choice (as created by disconnect or selection)
    localStorage.setItem(STORAGE_KEYS.vault.activeOwnerSub, subA);

    // Bootstrap with null authenticated session (disconnected state)
    await bootstrapApplication();

    expect(getActiveVaultDatabase().name).toBe(dbA.name);
  });

  it('5. explicit library switching transitions across separate physical databases and clears cache', async () => {
    const dbAccount = await createTestDb();
    const dbAnon = await createTestDb();
    const subAccount = 'account-user-5';

    await defaultRegistryDatabase.vaults.put({
      ownerSub: subAccount,
      physicalDbName: dbAccount.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    await defaultRegistryDatabase.vaults.put({
      ownerSub: ANONYMOUS_OWNER_SUB,
      physicalDbName: dbAnon.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    setActiveVaultDatabase(dbAccount);
    localStorage.setItem(STORAGE_KEYS.vault.activeOwnerSub, subAccount);

    const appRef = { current: null as ApplicationContextValue | null };
    function AppView() {
      const value = useContext(ApplicationContext);
      useEffect(() => {
        appRef.current = value;
      }, [value]);
      return <span data-testid="active-db">{value?.infrastructure.db.name}</span>;
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <AppView />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    // Initial database is dbAccount
    expect(screen.getByTestId('active-db').textContent).toBe(dbAccount.name);

    queryClient.setQueryData(['cached-key'], { secret: 'account-data' });
    expect(queryClient.getQueryData(['cached-key'])).toBeDefined();

    // Explicit switch to local-only (anonymous) library
    await act(async () => {
      await appRef.current!.switchActiveLibrary!(ANONYMOUS_OWNER_SUB);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-db').textContent).toBe(dbAnon.name);
    });

    // Cache was cleared across physical library boundary
    expect(queryClient.getQueryData(['cached-key'])).toBeUndefined();

    // Explicit switch back to account library
    await act(async () => {
      await appRef.current!.switchActiveLibrary!(subAccount);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-db').textContent).toBe(dbAccount.name);
    });
  });

  it('6. connecting with a different account while retained library is open transitions safely without data crossover', async () => {
    const dbA = await createTestDb();
    const dbB = await createTestDb();
    const subA = 'account-a-fenced';
    const subB = 'account-b-fenced';

    await defaultRegistryDatabase.vaults.put({
      ownerSub: subA,
      physicalDbName: dbA.name,
      createdAt: 1000,
      lastActiveAt: 1000,
    });
    await defaultRegistryDatabase.vaults.put({
      ownerSub: subB,
      physicalDbName: dbB.name,
      createdAt: 2000,
      lastActiveAt: 2000,
    });

    // Put mutation in dbA's syncQueue
    await dbA.syncQueue.add({
      id: 'q-a-secret',
      clientMutationId: 'mut-a-secret',
      entityType: 'document',
      entityId: 'doc-a',
      operation: 'UPSERT',
      clientTimestamp: '2026-10-22T04:00:00.000Z',
      payload: { id: 'doc-a', title: 'User A Secret' },
      status: 'pending',
      createdAt: '2026-10-22T04:00:00.000Z',
      retryCount: 0,
    });

    setActiveVaultDatabase(dbA);
    localStorage.setItem(STORAGE_KEYS.vault.activeOwnerSub, subA);

    const appRef = { current: null as ApplicationContextValue | null };
    function Capture() {
      const value = useContext(ApplicationContext);
      useEffect(() => {
        appRef.current = value;
      }, [value]);
      return <span data-testid="active-db">{value?.infrastructure.db.name}</span>;
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationProvider>
          <Capture />
        </ApplicationProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('active-db').textContent).toBe(dbA.name);

    // Now User B connects!
    await act(async () => {
      const sessionB = {
        user: { sub: subB, email: 'userb@example.invalid', name: 'User B' },
        tokens: {
          accessToken: 'TOKEN_B',
          expiresAt: Date.now() + 3600000,
          sealedRefreshToken: 'SEALED_B',
        },
      };
      (googleAuthService as any).session = sessionB;
      (googleAuthService as any).status = 'authenticated';
      (googleAuthService as any).sessionGeneration++;
      (googleAuthService as any).notifyListeners(sessionB);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-db').textContent).toBe(dbB.name);
    });

    expect(appRef.current?.infrastructure.db.name).toBe(dbB.name);

    // User A's queued mutation remains in dbA, never in dbB!
    expect(await dbA.syncQueue.count()).toBe(1);
    expect(await dbB.syncQueue.count()).toBe(0);
  });
});
