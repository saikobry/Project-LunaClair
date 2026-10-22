import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
  VaultRegistry,
  RegistryDatabase,
  generatePhysicalDbName,
  vaultRegistry,
  REGISTRY_DB_NAME,
} from '../VaultRegistry';
import { ANONYMOUS_OWNER_SUB } from '../../../../domain/vault/models/vault.types';

describe('VaultRegistry — physicalDbName generator', () => {
  it('generates collision-resistant physical names matching lc_vault_${32hex}', () => {
    const name1 = generatePhysicalDbName();
    const name2 = generatePhysicalDbName();

    expect(name1).toMatch(/^lc_vault_[0-9a-f]{32}$/);
    expect(name2).toMatch(/^lc_vault_[0-9a-f]{32}$/);
    expect(name1).not.toBe(name2);
  });
});

describe('VaultRegistry — Dexie adapter & lifecycle', () => {
  let testDb: RegistryDatabase;
  let registry: VaultRegistry;

  beforeEach(() => {
    testDb = new RegistryDatabase(`test_registry_${crypto.randomUUID().replace(/-/g, '')}`);
    registry = new VaultRegistry(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
    testDb.close();
  });

  it('exports singleton vaultRegistry targeting REGISTRY_DB_NAME', () => {
    expect(vaultRegistry).toBeInstanceOf(VaultRegistry);
    expect(vaultRegistry.getDatabase().name).toBe(REGISTRY_DB_NAME);
  });

  describe('getActiveVault', () => {
    it('creates an anonymous vault on first launch', async () => {
      const vault = await registry.getActiveVault();

      expect(vault.ownerSub).toBe(ANONYMOUS_OWNER_SUB);
      expect(vault.physicalDbName).toMatch(/^lc_vault_[0-9a-f]{32}$/);
      expect(vault.createdAt).toBeGreaterThan(0);
      expect(vault.lastActiveAt).toBeGreaterThanOrEqual(vault.createdAt);

      const stored = await testDb.vaults.get(ANONYMOUS_OWNER_SUB);
      expect(stored).toEqual(vault);
    });

    it('returns the existing anonymous vault on subsequent calls', async () => {
      const first = await registry.getActiveVault();
      const second = await registry.getActiveVault();

      expect(second.physicalDbName).toBe(first.physicalDbName);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.lastActiveAt).toBeGreaterThanOrEqual(first.lastActiveAt);

      const all = await testDb.vaults.toArray();
      expect(all).toHaveLength(1);
    });

    it('returns preferred user vault when preferredSub exists', async () => {
      await testDb.vaults.add({
        ownerSub: 'google-sub-456',
        physicalDbName: 'lc_vault_custom_user',
        createdAt: 1000,
        lastActiveAt: 1000,
      });

      const vault = await registry.getActiveVault('google-sub-456');

      expect(vault.ownerSub).toBe('google-sub-456');
      expect(vault.physicalDbName).toBe('lc_vault_custom_user');
      expect(vault.lastActiveAt).toBeGreaterThan(1000);
    });

    it('creates a new vault pointer for preferredSub when it does not exist', async () => {
      const anon = await registry.getActiveVault();
      const resolved = await registry.getActiveVault('non-existent-sub');

      expect(resolved.ownerSub).toBe('non-existent-sub');
      expect(resolved.physicalDbName).toMatch(/^lc_vault_[0-9a-f]{32}$/);
      expect(resolved.physicalDbName).not.toBe(anon.physicalDbName);

      const stored = await testDb.vaults.get('non-existent-sub');
      expect(stored).toEqual(resolved);
    });

    it('falls back to active anonymous vault only when preferredSub is undefined', async () => {
      const anon = await registry.getActiveVault();
      const resolved = await registry.getActiveVault(undefined);

      expect(resolved.ownerSub).toBe(ANONYMOUS_OWNER_SUB);
      expect(resolved.physicalDbName).toBe(anon.physicalDbName);
    });
  });

  describe('promoteAnonymousVault', () => {
    it('performs zero-copy promotion preserving physicalDbName and createdAt', async () => {
      const initialAnon = await registry.getActiveVault();
      const googleSub = 'google-sub-789';

      const result = await registry.promoteAnonymousVault(googleSub);

      expect(result.pointer.ownerSub).toBe(googleSub);
      expect(result.pointer.physicalDbName).toBe(initialAnon.physicalDbName);
      expect(result.pointer.createdAt).toBe(initialAnon.createdAt);
      expect(result.pointer.lastActiveAt).toBeGreaterThanOrEqual(initialAnon.lastActiveAt);
      expect(result.collisionFromAnonDb).toBeUndefined();

      // Anonymous pointer is deleted from registry
      const anonRow = await testDb.vaults.get(ANONYMOUS_OWNER_SUB);
      expect(anonRow).toBeUndefined();

      // Promoted user pointer exists
      const userRow = await testDb.vaults.get(googleSub);
      expect(userRow).toEqual(result.pointer);

      // getActiveVault with sub returns the promoted vault
      const active = await registry.getActiveVault(googleSub);
      expect(active.physicalDbName).toBe(initialAnon.physicalDbName);
    });

    it('creates fresh vault if neither target nor anonymous exists', async () => {
      const googleSub = 'brand-new-user';
      const result = await registry.promoteAnonymousVault(googleSub);

      expect(result.pointer.ownerSub).toBe(googleSub);
      expect(result.pointer.physicalDbName).toMatch(/^lc_vault_[0-9a-f]{32}$/);
      expect(result.collisionFromAnonDb).toBeUndefined();

      const stored = await testDb.vaults.get(googleSub);
      expect(stored).toEqual(result.pointer);
    });

    it('handles shared-device collision when target user already has a local vault', async () => {
      const googleSub = 'existing-user-sub';
      const existingUserDb = 'lc_vault_existing_db';

      // Seed existing authenticated vault
      await testDb.vaults.add({
        ownerSub: googleSub,
        physicalDbName: existingUserDb,
        createdAt: 2000,
        lastActiveAt: 2000,
      });

      // Anonymous work done afterwards
      const anonVault = await registry.getActiveVault();

      // Promotion occurs with existing target
      const result = await registry.promoteAnonymousVault(googleSub);

      expect(result.pointer.ownerSub).toBe(googleSub);
      expect(result.pointer.physicalDbName).toBe(existingUserDb);
      expect(result.pointer.lastActiveAt).toBeGreaterThan(2000);
      expect(result.collisionFromAnonDb).toBe(anonVault.physicalDbName);

      // Target vault preserved
      const userRow = await testDb.vaults.get(googleSub);
      expect(userRow?.physicalDbName).toBe(existingUserDb);

      // Anon vault pointer retained for caller merge
      const anonRow = await testDb.vaults.get(ANONYMOUS_OWNER_SUB);
      expect(anonRow?.physicalDbName).toBe(anonVault.physicalDbName);
    });
  });

  describe('listVaults', () => {
    it('lists all vaults sorted by lastActiveAt descending', async () => {
      await testDb.vaults.bulkAdd([
        {
          ownerSub: 'user-older',
          physicalDbName: 'lc_vault_older',
          createdAt: 1000,
          lastActiveAt: 1000,
        },
        {
          ownerSub: 'user-newer',
          physicalDbName: 'lc_vault_newer',
          createdAt: 2000,
          lastActiveAt: 3000,
        },
        {
          ownerSub: 'user-mid',
          physicalDbName: 'lc_vault_mid',
          createdAt: 1500,
          lastActiveAt: 2000,
        },
      ]);

      const list = await registry.listVaults();

      expect(list.map((v) => v.ownerSub)).toEqual(['user-newer', 'user-mid', 'user-older']);
    });
  });

  describe('switchActiveVault', () => {
    it('updates lastActiveAt and returns the switched vault', async () => {
      await testDb.vaults.add({
        ownerSub: 'target-user',
        physicalDbName: 'lc_vault_target',
        createdAt: 1000,
        lastActiveAt: 1000,
      });

      const switched = await registry.switchActiveVault('target-user');

      expect(switched.ownerSub).toBe('target-user');
      expect(switched.lastActiveAt).toBeGreaterThan(1000);

      const stored = await testDb.vaults.get('target-user');
      expect(stored?.lastActiveAt).toBe(switched.lastActiveAt);
    });

    it('throws when target vault does not exist', async () => {
      await expect(registry.switchActiveVault('ghost-user')).rejects.toThrow(
        'Vault for owner "ghost-user" not found',
      );
    });
  });

  describe('deleteVault', () => {
    it('deletes vault from registry and triggers Dexie.delete for physical DB', async () => {
      const deleteSpy = vi.spyOn(Dexie, 'delete').mockResolvedValue(undefined as never);

      await testDb.vaults.add({
        ownerSub: 'user-to-delete',
        physicalDbName: 'lc_vault_doomed',
        createdAt: 1000,
        lastActiveAt: 1000,
      });

      await registry.deleteVault('user-to-delete');

      expect(deleteSpy).toHaveBeenCalledWith('lc_vault_doomed');
      const stored = await testDb.vaults.get('user-to-delete');
      expect(stored).toBeUndefined();

      deleteSpy.mockRestore();
    });

    it('handles non-existent vault gracefully', async () => {
      const deleteSpy = vi.spyOn(Dexie, 'delete');
      await registry.deleteVault('does-not-exist');
      expect(deleteSpy).not.toHaveBeenCalled();
      deleteSpy.mockRestore();
    });
  });

  describe('quarantineVault and pruneStaleVaults', () => {
    it('quarantines an unlinked vault with pendingDeleteAt timestamp', async () => {
      await testDb.vaults.add({
        ownerSub: 'orphan-user',
        physicalDbName: 'lc_vault_orphan',
        createdAt: 1000,
        lastActiveAt: 1000,
      });

      const quarantineTarget = Date.now() + 50000;
      await registry.quarantineVault('orphan-user', quarantineTarget);

      const stored = await testDb.vaults.get('orphan-user');
      expect(stored?.pendingDeleteAt).toBe(quarantineTarget);
    });

    it('safeguards active vault and active user from pruning', async () => {
      await testDb.vaults.bulkAdd([
        {
          ownerSub: 'active-user',
          physicalDbName: 'lc_vault_active',
          createdAt: 1000,
          lastActiveAt: 2000,
        },
        {
          ownerSub: 'stale-user',
          physicalDbName: 'lc_vault_stale',
          createdAt: 1000,
          lastActiveAt: 1000,
          pendingDeleteAt: Date.now() - 1000, // expired
        },
      ]);

      const result = await registry.pruneStaleVaults('lc_vault_active', 'active-user', 0);

      expect(result.deleted).toEqual(['stale-user']);
      const activeStored = await testDb.vaults.get('active-user');
      expect(activeStored).toBeDefined();
      const staleStored = await testDb.vaults.get('stale-user');
      expect(staleStored).toBeUndefined();
    });
  });
});
