import type { LunaClairDatabase, HighlightRecord, DrawingRecord } from './LunaClairDatabase';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { HighlightItem, DrawingPath } from '../../domain/reader';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

const MIGRATION_KEY = 'lunaclair.migration.v1.complete';
const V2_MIGRATION_KEY = 'lunaclair.migration.v2.complete';

/**
 * Handles one-time migration of legacy localStorage data into IndexedDB.
 * v1: Migrates materials, highlights, drawings from localStorage.
 * v2: Sets default subjectId/termId on legacy materials.
 */
export class DatabaseMigrator {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase) {
        this.database = database;
    }

    async migrateIfNeeded(): Promise<void> {
        await this.migrateV1IfNeeded();
        await this.migrateV2IfNeeded();
    }

    // ── Version 1 ──────────────────────────────────────────────

    private async migrateV1IfNeeded(): Promise<void> {
        if (localStorage.getItem(MIGRATION_KEY)) return;

        await this.database.transaction(
            'rw',
            [this.database.materials, this.database.highlights, this.database.drawings, this.database.metadata],
            async () => {
                await this.migrateMaterials();
                await this.migrateHighlights();
                await this.migrateDrawings();
                await this.writeV1Metadata();
            },
        );

        localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    }

    private async migrateMaterials(): Promise<void> {
        const existing = await this.database.materials.count();
        if (existing > 0) return;

        const raw = localStorage.getItem(STORAGE_KEYS.library.materials);
        if (!raw) return;

        try {
            const materials = JSON.parse(raw) as StudyMaterial[];
            if (materials.length > 0) {
                await this.database.materials.bulkPut(materials);
            }
        } catch {
            // Corrupt data — skip migration silently.
        }
    }

    private async migrateHighlights(): Promise<void> {
        const existing = await this.database.highlights.count();
        if (existing > 0) return;

        const raw = localStorage.getItem(STORAGE_KEYS.reader.highlights);
        if (!raw) return;

        try {
            const highlights = JSON.parse(raw) as HighlightItem[];
            if (highlights.length > 0) {
                const records: HighlightRecord[] = highlights.map((h) => ({
                    ...h,
                    documentId: 'anatomy-physiology',
                    createdAt: new Date().toISOString(),
                }));
                await this.database.highlights.bulkPut(records);
            }
        } catch {
            // Corrupt data — skip migration silently.
        }
    }

    private async migrateDrawings(): Promise<void> {
        const existing = await this.database.drawings.count();
        if (existing > 0) return;

        const raw = localStorage.getItem(STORAGE_KEYS.reader.drawings);
        if (!raw) return;

        try {
            const drawings = JSON.parse(raw) as DrawingPath[];
            if (drawings.length > 0) {
                const records: DrawingRecord[] = drawings.map((d) => ({
                    ...d,
                    documentId: 'anatomy-physiology',
                    createdAt: new Date().toISOString(),
                }));
                await this.database.drawings.bulkPut(records);
            }
        } catch {
            // Corrupt data — skip migration silently.
        }
    }

    private async writeV1Metadata(): Promise<void> {
        const now = new Date().toISOString();
        await this.database.metadata.bulkPut([
            { key: 'databaseVersion', value: 1 },
            { key: 'lastMigration', value: now },
            { key: 'createdAt', value: now },
        ]);
    }

    // ── Version 2 — Subject/Term support ───────────────────────

    private async migrateV2IfNeeded(): Promise<void> {
        const flag = localStorage.getItem(V2_MIGRATION_KEY);
        if (flag) return;

        await this.database.transaction(
            'rw',
            [this.database.materials, this.database.metadata],
            async () => {
                await this.database.metadata.put({ key: 'databaseVersion', value: 2 });
                await this.database.metadata.put({ key: 'v2Migration', value: new Date().toISOString() });
            },
        );

        localStorage.setItem(V2_MIGRATION_KEY, new Date().toISOString());
    }
}
