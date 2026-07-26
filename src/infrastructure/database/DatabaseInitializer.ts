import { db } from './LunaClairDatabase';
import { DatabaseMigrator } from './DatabaseMigrator';
import { DatabaseSeeder } from './DatabaseSeeder';

/**
 * Application startup orchestrator for the database layer.
 * Opens the database, runs legacy migration, and seeds demo data if empty.
 */
export class DatabaseInitializer {
    private static initialized = false;

    static async initialize(): Promise<void> {
        if (DatabaseInitializer.initialized) return;

        await db.open();

        const migrator = new DatabaseMigrator(db);
        await migrator.migrateIfNeeded();

        const seeder = new DatabaseSeeder(db);
        await seeder.seedIfEmpty();

        DatabaseInitializer.initialized = true;
    }
}
