import { db } from './LunaClairDatabase';
import { DatabaseMigrator } from './DatabaseMigrator';

/**
 * Application startup orchestrator for the database layer.
 *
 * Opens the database and runs legacy localStorage migrations. Deliberately
 * does **not** seed anything: the canonical catalog lives in D1 and is
 * surfaced through the API as "Available Materials"; the user explicitly
 * imports materials into their local library. A fresh installation boots
 * with an empty library.
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
