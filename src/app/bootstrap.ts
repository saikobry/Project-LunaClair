import { STORAGE_KEYS } from '../shared/constants/storageKeys';
import { googleAuthService } from '../infrastructure/auth/google/GoogleAuthService';
import { DatabaseInitializer } from '../infrastructure/database/schema/DatabaseInitializer';
import { vaultRegistry } from '../infrastructure/database/registry/VaultRegistry';
import {
  openVaultDatabase,
  setActiveVaultDatabase,
} from '../infrastructure/database/schema/LunaClairDatabase';

/**
 * Initializes the application: resolves active vault from VaultRegistry,
 * opens the database, runs legacy migration, and seeds demo data if empty.
 */
let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapApplication(preferredSub?: string): Promise<void> {
  const persistedSub = typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_KEYS.vault.activeOwnerSub)
    : null;
  const targetSub = preferredSub ?? persistedSub ?? googleAuthService.getSession()?.user.sub;
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const activeVault = await vaultRegistry.getActiveVault(targetSub ?? undefined);
      if (typeof localStorage !== 'undefined' && activeVault.ownerSub && !localStorage.getItem(STORAGE_KEYS.vault.activeOwnerSub)) {
        localStorage.setItem(STORAGE_KEYS.vault.activeOwnerSub, activeVault.ownerSub);
      }
      const database = openVaultDatabase(activeVault.physicalDbName);
      setActiveVaultDatabase(database);
      await DatabaseInitializer.initialize(database);
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

export function resetBootstrapForTesting(): void {
  bootstrapPromise = null;
}
