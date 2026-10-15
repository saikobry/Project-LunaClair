import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
  LunaClairDatabase,
  openVaultDatabase,
  clearVaultDatabaseCache,
  setActiveVaultDatabase,
  getActiveVaultDatabase,
  resetActiveVaultDatabase,
  db,
} from '../LunaClairDatabase';

describe('Infrastructure: LunaClairDatabase dynamic vault resolution', () => {
  beforeEach(() => {
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
  });

  afterEach(async () => {
    resetActiveVaultDatabase();
    clearVaultDatabaseCache();
    await Dexie.delete('test_vault_alpha');
    await Dexie.delete('test_vault_beta');
  });

  it('preserves backwards compatibility with default db export', () => {
    expect(db).toBeInstanceOf(LunaClairDatabase);
    expect(getActiveVaultDatabase()).toBe(db);
  });

  it('instantiates new instances via LunaClairDatabase constructor', () => {
    const custom = new LunaClairDatabase('test_vault_alpha');
    expect(custom).toBeInstanceOf(LunaClairDatabase);
    expect(custom.name).toBe('test_vault_alpha');
  });

  it('opens and caches database instances by physical database name', () => {
    const db1 = openVaultDatabase('test_vault_alpha');
    const db2 = openVaultDatabase('test_vault_alpha');
    const db3 = openVaultDatabase('test_vault_beta');

    expect(db1).toBeInstanceOf(LunaClairDatabase);
    expect(db1.name).toBe('test_vault_alpha');
    expect(db1).toBe(db2);
    expect(db3.name).toBe('test_vault_beta');
    expect(db1).not.toBe(db3);
  });

  it('clears cached instances on clearVaultDatabaseCache()', () => {
    const db1 = openVaultDatabase('test_vault_alpha');
    clearVaultDatabaseCache();
    const db2 = openVaultDatabase('test_vault_alpha');

    expect(db1).not.toBe(db2);
    expect(db2.name).toBe('test_vault_alpha');
  });

  it('updates and resets active vault database pointer', () => {
    expect(getActiveVaultDatabase()).toBe(db);

    const vaultDb = openVaultDatabase('test_vault_alpha');
    setActiveVaultDatabase(vaultDb);
    expect(getActiveVaultDatabase()).toBe(vaultDb);

    resetActiveVaultDatabase();
    expect(getActiveVaultDatabase()).toBe(db);
  });
});
