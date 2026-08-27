import type { HighlightItem, DrawingPath } from '../../../domain/reader';
import type { AnnotationRepository } from '../../../domain/reader/AnnotationRepository';
import { db, type HighlightRecord, type DrawingRecord } from '../LunaClairDatabase';

export class DexieAnnotationRepository implements AnnotationRepository {
    async getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.highlights.where('documentId').equals(documentId).toArray();
        return records
            .filter((r) => !r.deletedAt)
            .map(({ documentId: _d, createdAt: _c, ...item }) => item);
    }

    async saveHighlights(documentId: string, highlights: HighlightItem[]): Promise<void> {
        await db.transaction('rw', [db.highlights, db.syncQueue], async () => {
            const existing = await db.highlights.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(highlights.map((h) => h.id));
            const now = new Date().toISOString();

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    const tombstone: HighlightRecord = {
                        ...old,
                        deletedAt: now,
                    };
                    await db.highlights.put(tombstone);
                    await db.syncQueue.put({
                        id: crypto.randomUUID(),
                        clientMutationId: crypto.randomUUID(),
                        entityType: 'highlight',
                        entityId: old.id,
                        operation: 'DELETE',
                        clientTimestamp: now,
                        payload: {
                            id: old.id,
                            documentId,
                            start: old.start,
                            end: old.end,
                            color: old.color,
                            text: old.text,
                            createdAt: old.createdAt,
                            deletedAt: now,
                        },
                        status: 'pending',
                        createdAt: now,
                        retryCount: 0,
                    });
                }
            }

            for (const h of highlights) {
                const record: HighlightRecord = {
                    ...h,
                    documentId,
                    createdAt: (h as unknown as HighlightRecord).createdAt ?? now,
                };
                await db.highlights.put(record);
                await db.syncQueue.put({
                    id: crypto.randomUUID(),
                    clientMutationId: crypto.randomUUID(),
                    entityType: 'highlight',
                    entityId: h.id,
                    operation: 'UPSERT',
                    clientTimestamp: now,
                    payload: {
                        id: h.id,
                        documentId,
                        start: h.start,
                        end: h.end,
                        color: h.color,
                        text: h.text,
                        createdAt: record.createdAt,
                    },
                    status: 'pending',
                    createdAt: now,
                    retryCount: 0,
                });
            }
        });
    }

    async clearHighlights(documentId: string): Promise<void> {
        await this.saveHighlights(documentId, []);
    }

    async getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.drawings.where('documentId').equals(documentId).toArray();
        return records
            .filter((r) => !r.deletedAt)
            .map(({ documentId: _d, createdAt: _c, ...path }) => path);
    }

    async saveDrawings(documentId: string, paths: DrawingPath[]): Promise<void> {
        await db.transaction('rw', [db.drawings, db.syncQueue], async () => {
            const existing = await db.drawings.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(paths.map((p) => p.id));
            const now = new Date().toISOString();

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    const tombstone: DrawingRecord = {
                        ...old,
                        deletedAt: now,
                    };
                    await db.drawings.put(tombstone);
                    await db.syncQueue.put({
                        id: crypto.randomUUID(),
                        clientMutationId: crypto.randomUUID(),
                        entityType: 'drawing',
                        entityId: old.id,
                        operation: 'DELETE',
                        clientTimestamp: now,
                        payload: {
                            id: old.id,
                            documentId,
                            color: old.color,
                            thickness: old.thickness,
                            points: old.points,
                            isEraser: old.isEraser,
                            createdAt: old.createdAt,
                            deletedAt: now,
                        },
                        status: 'pending',
                        createdAt: now,
                        retryCount: 0,
                    });
                }
            }

            for (const p of paths) {
                const record: DrawingRecord = {
                    ...p,
                    documentId,
                    createdAt: (p as unknown as DrawingRecord).createdAt ?? now,
                };
                await db.drawings.put(record);
                await db.syncQueue.put({
                    id: crypto.randomUUID(),
                    clientMutationId: crypto.randomUUID(),
                    entityType: 'drawing',
                    entityId: p.id,
                    operation: 'UPSERT',
                    clientTimestamp: now,
                    payload: {
                        id: p.id,
                        documentId,
                        color: p.color,
                        thickness: p.thickness,
                        points: p.points,
                        isEraser: p.isEraser,
                        createdAt: record.createdAt,
                    },
                    status: 'pending',
                    createdAt: now,
                    retryCount: 0,
                });
            }
        });
    }

    async clearDrawings(documentId: string): Promise<void> {
        await this.saveDrawings(documentId, []);
    }
}

export const dexieAnnotationRepository = new DexieAnnotationRepository();
