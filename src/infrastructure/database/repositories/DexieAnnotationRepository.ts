import type { HighlightItem, DrawingPath } from '../../../domain/reader/models/annotation.types';
import type { AnnotationRepository } from '../../../domain/reader/repositories/AnnotationRepository';
import { getActiveVaultDatabase, type LunaClairDatabase, type HighlightRecord, type DrawingRecord } from '../schema/LunaClairDatabase';
import { withOrigin } from '../sync/transactionContext';

export class DexieAnnotationRepository implements AnnotationRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await this.db.highlights.where('documentId').equals(documentId).toArray();
        const results: HighlightItem[] = [];
        for (const r of records) {
            if (!r.deletedAt) {
                const { documentId: _d, createdAt: _c, ...item } = r;
                results.push(item);
            }
        }
        return results;
    }

    async saveHighlights(documentId: string, highlights: HighlightItem[]): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.highlights], async () => {
            const existing = await this.db.highlights.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(highlights.map((h) => h.id));
            const now = new Date().toISOString();

            const highlightsToPut: HighlightRecord[] = [];

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    highlightsToPut.push({
                        ...old,
                        deletedAt: now,
                    });
                }
            }

            for (const h of highlights) {
                const record: HighlightRecord = {
                    ...h,
                    documentId,
                    createdAt: (h as unknown as HighlightRecord).createdAt ?? now,
                };
                highlightsToPut.push(record);
            }

            if (highlightsToPut.length > 0) {
                await this.db.highlights.bulkPut(highlightsToPut);
            }
        });
    }

    async clearHighlights(documentId: string): Promise<void> {
        await this.saveHighlights(documentId, []);
    }

    async getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await this.db.drawings.where('documentId').equals(documentId).toArray();
        const results: DrawingPath[] = [];
        for (const r of records) {
            if (!r.deletedAt) {
                const { documentId: _d, createdAt: _c, ...path } = r;
                results.push(path);
            }
        }
        return results;
    }

    async saveDrawings(documentId: string, paths: DrawingPath[]): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.drawings], async () => {
            const existing = await this.db.drawings.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(paths.map((p) => p.id));
            const now = new Date().toISOString();

            const drawingsToPut: DrawingRecord[] = [];

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    drawingsToPut.push({
                        ...old,
                        deletedAt: now,
                    });
                }
            }

            for (const p of paths) {
                const record: DrawingRecord = {
                    ...p,
                    documentId,
                    createdAt: (p as unknown as DrawingRecord).createdAt ?? now,
                };
                drawingsToPut.push(record);
            }

            if (drawingsToPut.length > 0) {
                await this.db.drawings.bulkPut(drawingsToPut);
            }
        });
    }

    async clearDrawings(documentId: string): Promise<void> {
        await this.saveDrawings(documentId, []);
    }
}

export const dexieAnnotationRepository = new DexieAnnotationRepository();
