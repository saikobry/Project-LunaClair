import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../schema/LunaClairDatabase';
import { DexieAnnotationRepository } from '../DexieAnnotationRepository';
import type { HighlightItem, DrawingPath } from '../../../../domain/reader/models/annotation.types';

describe('DexieAnnotationRepository Tombstone Filtering', () => {
    let repo: DexieAnnotationRepository;

    beforeEach(async () => {
        await db.highlights.clear();
        await db.drawings.clear();
        repo = new DexieAnnotationRepository();
    });

    it('returns only active highlights and ignores tombstoned records', async () => {
        const activeHighlight: HighlightItem = {
            id: 'hl-active-1',
            start: 0,
            end: 10,
            color: 'yellow',
            text: 'Active text',
        };

        await db.highlights.bulkPut([
            {
                ...activeHighlight,
                documentId: 'doc-1',
                createdAt: '2026-08-27T00:00:00.000Z',
            },
            {
                id: 'hl-tombstone-2',
                start: 12,
                end: 24,
                color: 'pink',
                text: 'Deleted text',
                documentId: 'doc-1',
                createdAt: '2026-08-27T00:00:00.000Z',
                deletedAt: '2026-08-27T01:00:00.000Z',
            },
        ]);

        const fetched = await repo.getHighlights('doc-1');
        expect(fetched).toHaveLength(1);
        expect(fetched[0].id).toBe('hl-active-1');
        expect(fetched[0].deletedAt).toBeUndefined();
    });

    it('returns only active drawings and ignores tombstoned paths', async () => {
        const activeDrawing: DrawingPath = {
            id: 'dr-active-1',
            color: '#ff0000',
            thickness: 2,
            points: [{ x: 0.1, y: 0.1 }],
        };

        await db.drawings.bulkPut([
            {
                ...activeDrawing,
                documentId: 'doc-1',
                createdAt: '2026-08-27T00:00:00.000Z',
            },
            {
                id: 'dr-tombstone-2',
                color: '#00ff00',
                thickness: 3,
                points: [{ x: 0.2, y: 0.2 }],
                documentId: 'doc-1',
                createdAt: '2026-08-27T00:00:00.000Z',
                deletedAt: '2026-08-27T01:00:00.000Z',
            },
        ]);

        const fetched = await repo.getDrawings('doc-1');
        expect(fetched).toHaveLength(1);
        expect(fetched[0].id).toBe('dr-active-1');
        expect(fetched[0].deletedAt).toBeUndefined();
    });
});
