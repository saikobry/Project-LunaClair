import { db } from './LunaClairDatabase';
import { DatabaseMigrator } from './DatabaseMigrator';

/**
 * Application startup orchestrator for the database layer.
 *
 * Opens the database and runs legacy localStorage migrations. Deliberately
 * does **not** seed anything: a fresh installation boots with an empty
 * library, and content arrives only when the user clones a `.lcpack` share
 * from the Explore hub (shares are the exclusive content distribution
 * mechanism — the official catalog was retired).
 */
export class DatabaseInitializer {
    private static initialized = false;

    static async initialize(): Promise<void> {
        if (DatabaseInitializer.initialized) return;

        await db.open();

        const migrator = new DatabaseMigrator(db);
        await migrator.migrateIfNeeded();

        DatabaseInitializer.initialized = true;
    }
}
