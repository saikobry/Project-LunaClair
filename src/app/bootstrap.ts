import { DatabaseInitializer } from '../infrastructure/database/schema/DatabaseInitializer';

/**
 * Initializes the application: opens the database, runs legacy migration,
 * and seeds demo data if empty.
 */
export async function bootstrapApplication(): Promise<void> {
  await DatabaseInitializer.initialize();
}
