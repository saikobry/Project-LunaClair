import Dexie, { type Table } from 'dexie';
import {
  ANONYMOUS_OWNER_SUB,
  type VaultPointer,
  type PromotionResult,
  type VaultRegistryPort,
} from '../../../domain/vault/models/vault.types';

/**
 * Standard database name for the master vault registry IndexedDB.
 */
export const REGISTRY_DB_NAME = 'lunaclair_registry';

/**
 * Generates a collision-resistant physical IndexedDB database name.
 * Format: `lc_vault_${uuid_hex32}`.
 */
export function generatePhysicalDbName(): string {
  return `lc_vault_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Dedicated Dexie database instance managing local vault pointers.
 */
export class RegistryDatabase extends Dexie {
  vaults!: Table<VaultPointer, string>;

  constructor(dbName: string = REGISTRY_DB_NAME) {
    super(dbName);
    this.version(1).stores({
      vaults: 'ownerSub, physicalDbName, lastActiveAt',
    });
  }
}

/**
 * Dexie-backed implementation of `VaultRegistryPort`.
 *
 * Decouples logical user identity (`ownerSub`) from physical IndexedDB database names
 * (`physicalDbName`) to enable zero-copy promotion when an anonymous user logs in.
 */
export class VaultRegistry implements VaultRegistryPort {
  private readonly db: RegistryDatabase;

  constructor(db: RegistryDatabase = defaultRegistryDatabase) {
    this.db = db;
  }

  /**
   * Returns the underlying Dexie database instance.
   */
  getDatabase(): RegistryDatabase {
    return this.db;
  }

  /**
   * Resolves the active vault pointer.
   * If `preferredSub` is given, returns that user's vault (creating one if it does not exist yet).
   * Otherwise returns the active 'ANONYMOUS' vault, creating it if no vault exists yet.
   */
  async getActiveVault(preferredSub?: string): Promise<VaultPointer> {
    return await this.db.transaction('rw', this.db.vaults, async () => {
      const now = Date.now();
      if (preferredSub) {
        const preferred = await this.db.vaults.get(preferredSub);
        if (preferred) {
          const updated: VaultPointer = {
            ...preferred,
            lastActiveAt: now,
          };
          await this.db.vaults.put(updated);
          return updated;
        }

        const newPreferred: VaultPointer = {
          ownerSub: preferredSub,
          physicalDbName: generatePhysicalDbName(),
          createdAt: now,
          lastActiveAt: now,
        };
        try {
          await this.db.vaults.add(newPreferred);
          return newPreferred;
        } catch {
          const existing = await this.db.vaults.get(preferredSub);
          if (existing) return existing;
          throw new Error('Failed to acquire or initialize active vault');
        }
      }

      const anon = await this.db.vaults.get(ANONYMOUS_OWNER_SUB);
      if (anon) {
        const updated: VaultPointer = {
          ...anon,
          lastActiveAt: now,
        };
        await this.db.vaults.put(updated);
        return updated;
      }

      const newAnon: VaultPointer = {
        ownerSub: ANONYMOUS_OWNER_SUB,
        physicalDbName: generatePhysicalDbName(),
        createdAt: now,
        lastActiveAt: now,
      };
      try {
        await this.db.vaults.add(newAnon);
        return newAnon;
      } catch {
        const existing = await this.db.vaults.get(ANONYMOUS_OWNER_SUB);
        if (existing) return existing;
        throw new Error('Failed to acquire or initialize active vault');
      }
    });
  }

  /**
   * Promotes an anonymous vault to an authenticated user identity.
   *
   * If no vault exists for `newOwnerSub`: atomically updates the row where
   * `ownerSub === 'ANONYMOUS'` to `ownerSub = newOwnerSub` (0 bytes copied, 0 ms latency).
   * If `newOwnerSub` already has a local vault: keeps existing vault and notes
   * `collisionFromAnonDb` from the anonymous vault so caller can merge data.
   */
  async promoteAnonymousVault(newOwnerSub: string): Promise<PromotionResult> {
    return await this.db.transaction('rw', this.db.vaults, async () => {
      const existingTarget = await this.db.vaults.get(newOwnerSub);
      const anonVault = await this.db.vaults.get(ANONYMOUS_OWNER_SUB);
      const now = Date.now();

      if (existingTarget) {
        const updatedExisting: VaultPointer = {
          ...existingTarget,
          lastActiveAt: now,
        };
        await this.db.vaults.put(updatedExisting);
        return {
          pointer: updatedExisting,
          collisionFromAnonDb: anonVault?.physicalDbName,
        };
      }

      if (anonVault) {
        await this.db.vaults.delete(ANONYMOUS_OWNER_SUB);
        const promoted: VaultPointer = {
          ...anonVault,
          ownerSub: newOwnerSub,
          lastActiveAt: now,
        };
        await this.db.vaults.add(promoted);
        return { pointer: promoted };
      }

      const freshVault: VaultPointer = {
        ownerSub: newOwnerSub,
        physicalDbName: generatePhysicalDbName(),
        createdAt: now,
        lastActiveAt: now,
      };
      await this.db.vaults.add(freshVault);
      return { pointer: freshVault };
    });
  }

  /**
   * Lists all registered vault pointers sorted by lastActiveAt descending.
   */
  async listVaults(): Promise<VaultPointer[]> {
    const vaults = await this.db.vaults.toArray();
    return vaults.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  /**
   * Switches the active vault to `targetSub`, updating its lastActiveAt timestamp.
   * Throws if targetSub vault does not exist.
   */
  async switchActiveVault(targetSub: string): Promise<VaultPointer> {
    const vault = await this.db.vaults.get(targetSub);
    if (!vault) {
      throw new Error(`Vault for owner "${targetSub}" not found`);
    }
    const updated: VaultPointer = {
      ...vault,
      lastActiveAt: Date.now(),
    };
    await this.db.vaults.put(updated);
    return updated;
  }

  /**
   * Deletes a vault and removes its physical IndexedDB database.
   */
  async deleteVault(ownerSub: string): Promise<void> {
    const vault = await this.db.vaults.get(ownerSub);
    if (!vault) {
      return;
    }
    await Dexie.delete(vault.physicalDbName);
    await this.db.vaults.delete(ownerSub);
  }

  /**
   * Quarantines an unlinked vault by recording a pendingDeleteAt timestamp.
   */
  async quarantineVault(ownerSub: string, quarantineUntil: number = Date.now() + 86400000): Promise<void> {
    const vault = await this.db.vaults.get(ownerSub);
    if (!vault) {
      return;
    }
    await this.db.vaults.put({
      ...vault,
      pendingDeleteAt: quarantineUntil,
    });
  }

  /**
   * Prunes orphan or unlinked vaults from the registry.
   * Safeguards: Never deletes the active database or current user vault.
   * Stale or expired quarantine vaults are deleted permanently.
   */
  async pruneStaleVaults(
    activeDbName: string,
    activeSub?: string,
    gracePeriodMs: number = 0,
  ): Promise<{ quarantined: string[]; deleted: string[] }> {
    const vaults = await this.db.vaults.toArray();
    const now = Date.now();
    const quarantined: string[] = [];
    const deleted: string[] = [];

    for (const vault of vaults) {
      if (vault.physicalDbName === activeDbName) {
        continue;
      }
      if (activeSub && vault.ownerSub === activeSub) {
        continue;
      }

      if (vault.pendingDeleteAt && vault.pendingDeleteAt <= now) {
        await this.deleteVault(vault.ownerSub);
        deleted.push(vault.ownerSub);
      } else if (!vault.pendingDeleteAt) {
        if (gracePeriodMs === 0) {
          await this.deleteVault(vault.ownerSub);
          deleted.push(vault.ownerSub);
        } else {
          await this.quarantineVault(vault.ownerSub, now + gracePeriodMs);
          quarantined.push(vault.ownerSub);
        }
      }
    }

    return { quarantined, deleted };
  }
}

export const defaultRegistryDatabase = new RegistryDatabase();
export const vaultRegistry = new VaultRegistry(defaultRegistryDatabase);
