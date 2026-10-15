import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
