import type { HighlightItem, DrawingPath } from '../../../shared/types/annotation.types';
import type { AnnotationRepository } from '../../../domain/reader/AnnotationRepository';
import { db, type HighlightRecord, type DrawingRecord } from '../LunaClairDatabase';

export class DexieAnnotationRepository implements AnnotationRepository {
    async getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.highlights.where('documentId').equals(documentId).toArray();
        return records.map(({ documentId: _d, createdAt: _c, ...item }) => item);
    }

    async saveHighlights(documentId: string, highlights: HighlightItem[]): Promise<void> {
        await db.transaction('rw', db.highlights, async () => {
            await db.highlights.where('documentId').equals(documentId).delete();
            const records: HighlightRecord[] = highlights.map((h) => ({
                ...h,
                documentId,
                createdAt: new Date().toISOString(),
            }));
            if (records.length > 0) {
                await db.highlights.bulkPut(records);
            }
        });
    }

    async clearHighlights(documentId: string): Promise<void> {
        await db.highlights.where('documentId').equals(documentId).delete();
    }

    async getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.drawings.where('documentId').equals(documentId).toArray();
        return records.map(({ documentId: _d, createdAt: _c, ...path }) => path);
    }

    async saveDrawings(documentId: string, paths: DrawingPath[]): Promise<void> {
        await db.transaction('rw', db.drawings, async () => {
            await db.drawings.where('documentId').equals(documentId).delete();
            const records: DrawingRecord[] = paths.map((p) => ({
                ...p,
                documentId,
                createdAt: new Date().toISOString(),
            }));
            if (records.length > 0) {
                await db.drawings.bulkPut(records);
            }
        });
    }

    async clearDrawings(documentId: string): Promise<void> {
        await db.drawings.where('documentId').equals(documentId).delete();
    }
}

export const dexieAnnotationRepository = new DexieAnnotationRepository();
