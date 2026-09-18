import { db } from './LunaClairDatabase';
import { DatabaseMigrator } from './DatabaseMigrator';
import {
    DatabaseReloadRequiredError,
    isStoredDatabaseNewer,
    readStoredDatabaseVersion,
} from './databaseLifecycle';

/**
 * Application startup orchestrator for the database layer.
 *
 * Opens the database and runs legacy localStorage migrations. Deliberately
 * does **not** seed anything: a fresh installation boots with an empty
 * library, and content arrives only when the user clones a `.lcpack` share
 * from the Explore hub (shares are the exclusive content distribution
 * mechanism — the official catalog was retired).
 *
 * It checks the version already stored *before* opening, and refuses to proceed when a newer build
ows it (`DatabaseReloadRequiredError`) — the only correct recovery is a reload onto the current
 * build, which callers must surface rather than treat as a crash (`databaseLifecycle.ts`).
 *
 * **The check has to run before `db.open()`, because opening is not a safe way to find out.** A
 * stored database that is newer than this bundle's declaration does *not* make `open()` reject:
 * Dexie catches the `VersionError`, reopens unnamed at the stored version, and then treats the
 * mismatch as a schema diff to patch — adding whatever this stale declaration is missing, bumping
 * the native version permanently (150 → 151) and resurrecting indexes the newer build retired (v15's
 * whole point). Ordering the check first is what keeps a stale bundle from rewriting the schema of a
 * database it cannot understand. Failures other than a newer stored database are left alone: they
 * are real bugs and should stay loud.
 */
export class DatabaseInitializer {
    private static initialized = false;

    static async initialize(): Promise<void> {
        if (DatabaseInitializer.initialized) return;

        const storedVersion = await readStoredDatabaseVersion(db.name);
        if (storedVersion !== null && isStoredDatabaseNewer(storedVersion, db.verno)) {
            throw new DatabaseReloadRequiredError('app-updated', db.name);
        }

        await db.open();

        const migrator = new DatabaseMigrator(db);
        await migrator.migrateIfNeeded();

        DatabaseInitializer.initialized = true;
    }
}
