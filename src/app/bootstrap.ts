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
export async function bootstrapApplication(): Promise<void> {
  const activeVault = await vaultRegistry.getActiveVault();
  const database = openVaultDatabase(activeVault.physicalDbName);
  setActiveVaultDatabase(database);
  await DatabaseInitializer.initialize(database);
}
