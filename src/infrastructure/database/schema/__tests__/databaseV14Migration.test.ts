import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
    DB_NAME,
    SCHEMA_V1,
    SCHEMA_V2,
    SCHEMA_V3,
    SCHEMA_V4,
    SCHEMA_V5,
    SCHEMA_V6,
    SCHEMA_V7,
    SCHEMA_V8,
    SCHEMA_V9,
    SCHEMA_V10,
    SCHEMA_V11,
    SCHEMA_V12,
    SCHEMA_V13,
    SCHEMA_V14,
} from '../schema';
import { LunaClairDatabase } from '../LunaClairDatabase';

/** Row shape of the v10–v13 `importAssets` store (one blob per `materialId`). */
type LegacyImportAssetRecord = {
    materialId: string;
    blob: Blob;
    mimeType: string;
    filename: string;
    importedAt: string;
};

/**
 * A v13-shaped database built from the real historical schema constants, so the upgrade under
 * test is the same one a real user's IndexedDB would run (IndexedDB cannot change an object
 * store's primary key in place, so a hand-rolled approximation would hide the failure).
 */
class TestV13Database extends Dexie {
    constructor() {
        super(DB_NAME);
        this.version(1).stores(SCHEMA_V1);
        this.version(2).stores(SCHEMA_V2);
        this.version(3).stores(SCHEMA_V3);
        this.version(4).stores(SCHEMA_V4);
        this.version(5).stores(SCHEMA_V5);
        this.version(6).stores(SCHEMA_V6);
        this.version(7).stores(SCHEMA_V7);
        this.version(8).stores(SCHEMA_V8);
        this.version(9).stores(SCHEMA_V9);
        this.version(10).stores(SCHEMA_V10);
        this.version(11).stores(SCHEMA_V11);
        this.version(12).stores(SCHEMA_V12);
        this.version(13).stores(SCHEMA_V13);
    }
}

describe('Dexie Schema v14 — local binary asset rekey', () => {
    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    afterEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    it('migrates every v13 importAssets row to localAssets, preserving assetId === materialId', async () => {
        const v13Db = new TestV13Database();
        await v13Db.open();
        expect(v13Db.verno).toBe(13);

        const legacyRows: LegacyImportAssetRecord[] = [
            {
                materialId: 'mat-imported-1',
                blob: new Blob(['PDF BYTES'], { type: 'application/pdf' }),
                mimeType: 'application/pdf',
                filename: 'lecture.pdf',
                importedAt: '2026-08-01T08:00:00.000Z',
            },
            {
                materialId: 'mat-cloned-2',
                blob: new Blob(['PNG BYTES'], { type: 'image/png' }),
                mimeType: 'image/png',
                filename: 'figure41a.png',
                importedAt: '2026-08-02T09:30:00.000Z',
            },
        ];
        await v13Db.table('importAssets').bulkPut(legacyRows);
        v13Db.close();

        const v14Db = new LunaClairDatabase();
        await v14Db.open();

        expect(v14Db.verno).toBe(14);

        // The store is replaced, not mutated: the legacy name is gone and the new one exists.
        const tableNames = v14Db.tables.map((table) => table.name);
        expect(tableNames).not.toContain('importAssets');
        expect(tableNames).toContain('localAssets');

        const migrated = await v14Db.localAssets.toArray();
        expect(migrated).toHaveLength(legacyRows.length);

        // The invariant that makes legacy `lc-asset://{materialId}` references resolvable.
        for (const row of migrated) {
            expect(row.assetId).toBe(row.materialId);
        }

        // Field-by-field preservation, blob bytes included.
        for (const legacy of legacyRows) {
            const stored = await v14Db.localAssets.get(legacy.materialId);
            expect(stored).toBeDefined();
            expect(stored?.assetId).toBe(legacy.materialId);
            expect(stored?.materialId).toBe(legacy.materialId);
            expect(stored?.filename).toBe(legacy.filename);
            expect(stored?.mimeType).toBe(legacy.mimeType);
            expect(stored?.importedAt).toBe(legacy.importedAt);
            // Blob payload is asserted as carried, not byte-compared: jsdom + fake-indexeddb
            // read a stored Blob back as a plain object with its bytes dropped (test-env limit).
            expect(stored?.blob).toBeDefined();
            expect(stored?.blob).not.toBeNull();
        }

        // Grouping index is queryable after the rekey.
        const grouped = await v14Db.localAssets.where('materialId').equals('mat-cloned-2').toArray();
        expect(grouped).toHaveLength(1);
        expect(grouped[0].assetId).toBe('mat-cloned-2');

        // A legacy document reference resolves with zero markdown rewrite.
        const legacyReference = 'lc-asset://mat-imported-1';
        expect(await v14Db.localAssets.get(legacyReference.replace('lc-asset://', ''))).toBeDefined();

        v14Db.close();
    });

    it('migrates cleanly when v13 held no binary assets', async () => {
        const v13Db = new TestV13Database();
        await v13Db.open();
        v13Db.close();

        const v14Db = new LunaClairDatabase();
        await v14Db.open();

        expect(v14Db.verno).toBe(14);
        expect(v14Db.tables.map((table) => table.name)).not.toContain('importAssets');
        expect(await v14Db.localAssets.count()).toBe(0);

        v14Db.close();
    });

    it('matches the SCHEMA_V14 definition', () => {
        expect(SCHEMA_V14.importAssets).toBeNull();
        expect(SCHEMA_V14.localAssets).toBe('assetId, materialId');
    });
});
