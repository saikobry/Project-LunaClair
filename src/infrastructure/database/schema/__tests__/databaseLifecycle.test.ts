import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME, SCHEMA_V14, SCHEMA_V15 } from '../schema';
import { LunaClairDatabase } from '../LunaClairDatabase';
import { DatabaseInitializer } from '../DatabaseInitializer';
import {
    DatabaseReloadRequiredError,
    isStoredDatabaseNewer,
    readStoredDatabaseVersion,
} from '../databaseLifecycle';

/**
 * IndexedDB's own store/index listing for a database.
 *
 * Schema assertions have to read the native listing rather than Dexie's: `Table.schema` reports the
 * *declaration*, so it cannot tell a patch's work apart from the schema it claims to have.
 */
async function readNativeSchema(databaseName: string): Promise<{
    version: number;
    indexes: Record<string, string[]>;
}> {
    const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const indexes: Record<string, string[]> = {};
    for (const storeName of Array.from(idb.objectStoreNames)) {
        const store = idb.transaction(storeName).objectStore(storeName);
        indexes[storeName] = Array.from(store.indexNames).sort();
    }
    const { version } = idb;
    idb.close();

    return { version, indexes };
}

describe('database lifecycle reporting', () => {
    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    afterEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    it('reads a stored database as newer only when a schema version is genuinely ahead', () => {
        // This build's own cases: the version it declares, and an older database it will upgrade.
        expect(isStoredDatabaseNewer(150, 15)).toBe(false);
        expect(isStoredDatabaseNewer(140, 15)).toBe(false);

        // Patch artifacts, where Dexie reopened one native step higher. Rounding puts them back on
        // the version that produced them — reading them as "newer" would loop the reload forever.
        expect(isStoredDatabaseNewer(151, 15)).toBe(false);
        expect(isStoredDatabaseNewer(152, 15)).toBe(false);

        // A genuinely newer build is a full factor away, patched or not.
        expect(isStoredDatabaseNewer(160, 15)).toBe(true);
        expect(isStoredDatabaseNewer(161, 15)).toBe(true);
        expect(isStoredDatabaseNewer(990, 15)).toBe(true);
        expect(isStoredDatabaseNewer(991, 15)).toBe(true);
    });

    it('reads the stored version, creating and upgrading nothing', async () => {
        // Nothing stored: the unnamed open is rolled back rather than kept. A database left behind at
        // native 1 would send Dexie down its per-version upgrade path on a fresh install, where v8's
        // primary-key change cannot be applied — the install would fail to open at all.
        await Dexie.delete('lunaclair-version-probe');
        expect(await readStoredDatabaseVersion('lunaclair-version-probe')).toBeNull();

        const probed = new LunaClairDatabase('lunaclair-version-probe');
        await probed.open();
        probed.close();
        const afterProbe = await readNativeSchema('lunaclair-version-probe');

        await Dexie.delete('lunaclair-version-probe');
        const unprobed = new LunaClairDatabase('lunaclair-version-probe');
        await unprobed.open();
        unprobed.close();
        const withoutProbe = await readNativeSchema('lunaclair-version-probe');

        // A probed fresh install reaches the same database as an unprobed one, and the encoding the
        // rule depends on holds: Dexie stores this build's v15 database as native 150. If that ever
        // stops being true, this fails loudly instead of the guard quietly matching nothing.
        expect(afterProbe).toEqual(withoutProbe);
        expect(unprobed.verno).toBe(15);
        expect(withoutProbe.version).toBe(150);

        // Reading an existing database reports its exact version, repeatedly, and changes nothing.
        expect(await readStoredDatabaseVersion('lunaclair-version-probe')).toBe(150);
        expect((await readNativeSchema('lunaclair-version-probe')).version).toBe(150);

        await Dexie.delete('lunaclair-version-probe');
    });

    it('maps a version change and a blocked upgrade to reload reasons', () => {
        const probe = new LunaClairDatabase('lunaclair-lifecycle-probe');
        const reasons: string[] = [];
        const unsubscribe = probe.onReloadRequired((reason) => reasons.push(reason));

        // Another build in another tab upgrades (or a delete request arrives, newVersion 0 — what the
        // e2e setup and DevTools send) …
        probe.on('versionchange').fire({ newVersion: 16, oldVersion: 15 });
        // … and this build being held back by an older connection, whose `open()` stays pending.
        probe.on('blocked').fire({ newVersion: 16, oldVersion: 15 });
        probe.on('versionchange').fire({ newVersion: 0, oldVersion: 15 });

        expect(reasons).toEqual(['app-updated', 'upgrade-blocked', 'database-reset']);

        // Unsubscribing stops delivery — the app must not be told after it unmounts.
        unsubscribe();
        probe.on('blocked').fire({ newVersion: 16, oldVersion: 15 });
        expect(reasons).toHaveLength(3);

        probe.close();
    });

    it('refuses a database a newer build owns, and leaves its schema untouched', async () => {
        // A v16 build that dropped a store v15 declares. Its declaration differs from v15's, which is
        // what makes the difference between refusing and patching observable on disk.
        const { localAssets: _droppedInV16, ...SCHEMA_V16 } = SCHEMA_V15;
        class FutureBuildDatabase extends Dexie {
            constructor() {
                super(DB_NAME);
                this.version(16).stores(SCHEMA_V16);
            }
        }

        const future = new FutureBuildDatabase();
        await future.open();
        await future.table('materials').put({ id: 'mat-1', title: 'Written by the newer build' });
        future.close();

        expect(await readStoredDatabaseVersion(DB_NAME)).toBe(160);

        // One call, captured: a second would be short-circuited only if the first had succeeded.
        const failure = await DatabaseInitializer.initialize().catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(DatabaseReloadRequiredError);
        expect((failure as DatabaseReloadRequiredError).reason).toBe('app-updated');

        // The point of checking before opening: had `db.open()` run, Dexie would have patched the
        // newer database up to this declaration — re-creating `localAssets` and bumping native to 161.
        const native = await readNativeSchema(DB_NAME);
        expect(native.version).toBe(160);
        expect(native.indexes.localAssets).toBeUndefined();

        const rows = await new Promise<unknown[]>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onsuccess = () => {
                const idb = request.result;
                const getAll = idb.transaction('materials').objectStore('materials').getAll();
                getAll.onsuccess = () => {
                    const { result } = getAll;
                    idb.close();
                    resolve(result as unknown[]);
                };
                getAll.onerror = () => reject(getAll.error);
            };
            request.onerror = () => reject(request.error);
        });
        expect(rows).toEqual([{ id: 'mat-1', title: 'Written by the newer build' }]);
    });

    it('documents the fault the check avoids: a stale declaration patches a newer database', async () => {
        const current = new LunaClairDatabase();
        await current.open();
        current.close();

        // A bundle from before v15 still declares the indexes v15 retired, so its declaration does not
        // match the stored schema. Dexie does not fail: it patches the database to fit the old
        // declaration. This is a plain Dexie, deliberately outside the initializer, because the guard's
        // job is to stop the real one from ever taking this path.
        class LegacyBundleDatabase extends Dexie {
            constructor() {
                super(DB_NAME);
                this.version(14).stores(SCHEMA_V14);
            }
        }

        const legacy = new LegacyBundleDatabase();
        await legacy.open();
        legacy.close();

        const native = await readNativeSchema(DB_NAME);
        expect(native.version).toBe(151);
        // A v15-retired index, resurrected by a patch that runs before any application logic. Reading
        // the version back rounds 151 onto 15, which is why this patch cannot be mistaken for a newer
        // build and cannot trap the tab in a reload loop.
        expect(native.indexes.materials).toContain('originShareId');
        expect(await readStoredDatabaseVersion(DB_NAME)).toBe(151);
        expect(isStoredDatabaseNewer(151, 15)).toBe(false);
    });
});
