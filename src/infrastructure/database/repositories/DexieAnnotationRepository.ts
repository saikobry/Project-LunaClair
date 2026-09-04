import type { HighlightItem, DrawingPath } from '../../../domain/reader/models/annotation.types';
import type { AnnotationRepository } from '../../../domain/reader/repositories/AnnotationRepository';
import type { SyncQueueItem } from '../../../domain/sync/models/sync.types';
import { db, type HighlightRecord, type DrawingRecord } from '../schema/LunaClairDatabase';

export class DexieAnnotationRepository implements AnnotationRepository {
    async getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.highlights.where('documentId').equals(documentId).toArray();
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
        await db.transaction('rw', [db.highlights, db.syncQueue], async () => {
            const existing = await db.highlights.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(highlights.map((h) => h.id));
            const now = new Date().toISOString();

            const highlightsToPut: HighlightRecord[] = [];
            const queueItemsToPut: SyncQueueItem[] = [];

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    highlightsToPut.push({
                        ...old,
                        deletedAt: now,
                    });
                    queueItemsToPut.push({
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
                highlightsToPut.push(record);
                queueItemsToPut.push({
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

            if (highlightsToPut.length > 0) {
                await db.highlights.bulkPut(highlightsToPut);
            }
            if (queueItemsToPut.length > 0) {
                await db.syncQueue.bulkPut(queueItemsToPut);
            }
        });
    }

    async clearHighlights(documentId: string): Promise<void> {
        await this.saveHighlights(documentId, []);
    }

    async getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const records = await db.drawings.where('documentId').equals(documentId).toArray();
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
        await db.transaction('rw', [db.drawings, db.syncQueue], async () => {
            const existing = await db.drawings.where('documentId').equals(documentId).toArray();
            const incomingIds = new Set(paths.map((p) => p.id));
            const now = new Date().toISOString();

            const drawingsToPut: DrawingRecord[] = [];
            const queueItemsToPut: SyncQueueItem[] = [];

            for (const old of existing) {
                if (!incomingIds.has(old.id) && !old.deletedAt) {
                    drawingsToPut.push({
                        ...old,
                        deletedAt: now,
                    });
                    queueItemsToPut.push({
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
                drawingsToPut.push(record);
                queueItemsToPut.push({
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

            if (drawingsToPut.length > 0) {
                await db.drawings.bulkPut(drawingsToPut);
            }
            if (queueItemsToPut.length > 0) {
                await db.syncQueue.bulkPut(queueItemsToPut);
            }
        });
    }

    async clearDrawings(documentId: string): Promise<void> {
        await this.saveDrawings(documentId, []);
    }
}

export const dexieAnnotationRepository = new DexieAnnotationRepository();
