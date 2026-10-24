import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
  createInfrastructure,
  createInfrastructureAsync,
} from '../createInfrastructure';
import {
  openVaultDatabase,
  resetActiveVaultDatabase,
  clearVaultDatabaseCache,
  getActiveVaultDatabase,
} from '../../../infrastructure/database/schema/LunaClairDatabase';
import {
  VaultRegistry,
  RegistryDatabase,
} from '../../../infrastructure/database/registry/VaultRegistry';
import { ANONYMOUS_OWNER_SUB } from '../../../domain/vault/models/vault.types';
import type { SyncControlPort } from '../../../domain/sync/services/SyncControlPort';

describe('Bootstrap: createInfrastructure dynamic vault integration', () => {
  const REGISTRY_TEST_DB = 'test_registry_create_infra';
  let registryDb: RegistryDatabase;
  let testRegistry: VaultRegistry;

  beforeEach(() => {
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    registryDb = new RegistryDatabase(REGISTRY_TEST_DB);
    testRegistry = new VaultRegistry(registryDb);
  });

  afterEach(async () => {
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    await registryDb.delete();
    await Dexie.delete('test_vault_one');
    await Dexie.delete('test_vault_two');
  });

  it('creates infrastructure with default active database when no argument is supplied', () => {
    const infra = createInfrastructure();
    expect(infra.db).toBe(getActiveVaultDatabase());
  });

  it('binds repositories and services to explicit database instance', async () => {
    const customDb = openVaultDatabase('test_vault_one');
    const infra = createInfrastructure(undefined, customDb);

    expect(infra.db).toBe(customDb);

    // Verify repository writes land in customDb
    const material = await infra.repositories.library.createMaterial({
      title: 'Vault One Material',
      description: 'Testing vault isolation',
    });

    const readBack = await customDb.materials.get(material.id);
    expect(readBack).toBeDefined();
    expect(readBack?.title).toBe('Vault One Material');

    // Confirm another database does not see it
    const otherDb = openVaultDatabase('test_vault_two');
    const absent = await otherDb.materials.get(material.id);
    expect(absent).toBeUndefined();
  });

  it('resolves active vault asynchronously and binds infrastructure', async () => {
    // Register a preferred vault in testRegistry via promotion
    const promo = await testRegistry.promoteAnonymousVault('user-sub-101');
    expect(promo.pointer.ownerSub).toBe('user-sub-101');

    const infra = await createInfrastructureAsync(undefined, 'user-sub-101', testRegistry);
    expect(infra.db.name).toBe(promo.pointer.physicalDbName);
    expect(infra.db).toBe(getActiveVaultDatabase());

    // Verify service write path
    const created = await infra.repositories.library.createMaterial({
      title: 'Async Vault Material',
      description: 'From active vault',
    });

    const fetched = await infra.repositories.library.getMaterialById(created.id);
    expect(fetched?.title).toBe('Async Vault Material');

    await Dexie.delete(promo.pointer.physicalDbName);
  });

  it('exposes googleAuthService on providers.auth and dynamically routes sync transport', async () => {
    const { googleAuthService } = await import('../../../infrastructure/auth/google/GoogleAuthService');
    const { GoogleDriveSyncTransport } = await import('../../../infrastructure/api/transports/GoogleDriveSyncTransport');

    const getSessionSpy = vi.spyOn(googleAuthService, 'getSession');
    getSessionSpy.mockReturnValue(null);

    // 1. Anonymous runtime created while unauthenticated
    const infraAnon = createInfrastructure();
    expect(infraAnon.providers.auth).toBe(googleAuthService);
    expect(infraAnon.providers.credentials).toBeDefined();
    await expect(infraAnon.providers.credentials.getCredentials()).resolves.toBeNull();

    const drivePushSpy = vi.spyOn(GoogleDriveSyncTransport.prototype, 'push').mockResolvedValue({
      accepted: [],
      conflicts: [],
      rejected: [],
    });

    // Old anonymous runtime remains standby for anonymous credentials
    const pushResult = await infraAnon.transports.sync.push(
      { userId: ANONYMOUS_OWNER_SUB, deviceId: 'dev-1' } as any,
      { deviceId: 'dev-1', mutations: [] }
    );
    expect(pushResult).toEqual({ accepted: [], conflicts: [], rejected: [] });
    expect(drivePushSpy).not.toHaveBeenCalled();

    const pullResult = await infraAnon.transports.sync.pull(
      { userId: ANONYMOUS_OWNER_SUB, deviceId: 'dev-1' } as any,
      10
    );
    expect(pullResult).toEqual({ newCursor: 10, hasMore: false, changes: [] });
    expect(drivePushSpy).not.toHaveBeenCalled();

    // Anonymous runtime rejects authenticated credentials
    await expect(
      infraAnon.transports.sync.push(
        { userId: 'sub-1', deviceId: 'dev-1' } as any,
        { deviceId: 'dev-1', mutations: [] }
      )
    ).rejects.toThrow(/Runtime identity mismatch/i);
    expect(drivePushSpy).not.toHaveBeenCalled();

    // 2. Create a FRESH runtime while authenticated with matching userId
    const authSession = {
      user: { sub: 'sub-1', email: 'a@b.com', name: 'User' },
      tokens: { accessToken: 'token', expiresAt: 9999999999, sealedRefreshToken: 'sealed' },
    };
    getSessionSpy.mockReturnValue(authSession);

    const infraAuth = createInfrastructure();

    // Matching userId routes to GoogleDriveSyncTransport
    await infraAuth.transports.sync.push(
      { userId: 'sub-1', deviceId: 'dev-1' } as any,
      { deviceId: 'dev-1', mutations: [] }
    );
    expect(drivePushSpy).toHaveBeenCalledTimes(1);

    // Wrong userId rejects without calling Drive
    await expect(
      infraAuth.transports.sync.push(
        { userId: 'sub-wrong', deviceId: 'dev-1' } as any,
        { deviceId: 'dev-1', mutations: [] }
      )
    ).rejects.toThrow(/Runtime identity mismatch/i);
    expect(drivePushSpy).toHaveBeenCalledTimes(1);

    // Restore mocks and dispose runtimes
    infraAnon.dispose?.();
    infraAuth.dispose?.();
    getSessionSpy.mockRestore();
    drivePushSpy.mockRestore();
  });

  it('same-owner reconnect releases hydration suspension when vault is not paused by user', () => {
    const customDb = openVaultDatabase('test_vault_one');
    const mockControl: SyncControlPort = {
      isPaused: vi.fn().mockReturnValue(false),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    const infra = createInfrastructure(undefined, customDb, testRegistry, 'user-sub-1', mockControl);

    expect(infra.services.hydration.isPaused()).toBe(false);

    // Disconnect pauses hydration
    infra.retireCloudWork?.();
    expect(infra.services.hydration.isPaused()).toBe(true);

    // Rebind releases suspension because vault is unpaused and authenticated
    infra.rebindCloudRuntime?.(2);
    expect(infra.services.hydration.isPaused()).toBe(false);

    infra.dispose?.();
  });

  it('same-owner reconnect preserves hydration suspension when deliberately paused by user', () => {
    const customDb = openVaultDatabase('test_vault_one');
    const mockControl: SyncControlPort = {
      isPaused: vi.fn().mockReturnValue(true),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    const infra = createInfrastructure(undefined, customDb, testRegistry, 'user-sub-1', mockControl);

    expect(infra.services.hydration.isPaused()).toBe(true);

    infra.retireCloudWork?.();
    expect(infra.services.hydration.isPaused()).toBe(true);

    // Rebind does not resume because user deliberately paused this vault
    infra.rebindCloudRuntime?.(2);
    expect(infra.services.hydration.isPaused()).toBe(true);

    infra.dispose?.();
  });

  it('rebindCloudRuntime on anonymous vault never resumes hydration suspension', () => {
    const customDb = openVaultDatabase('test_vault_one');
    const mockControl: SyncControlPort = {
      isPaused: vi.fn().mockReturnValue(false),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    const infra = createInfrastructure(undefined, customDb, testRegistry, ANONYMOUS_OWNER_SUB, mockControl);

    infra.retireCloudWork?.();
    expect(infra.services.hydration.isPaused()).toBe(true);

    // Rebind does not resume on anonymous vault
    infra.rebindCloudRuntime?.(2);
    expect(infra.services.hydration.isPaused()).toBe(true);

    infra.dispose?.();
  });
});
