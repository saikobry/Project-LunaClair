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
    SCHEMA_V15,
} from '../schema';
import { LunaClairDatabase } from '../LunaClairDatabase';

/**
 * A v14-shaped database built from the real historical schema constants, so the upgrade under test
 * is the same one a real user's IndexedDB runs. v15 is index-only, but "index-only" is exactly the
 * case where a wrong assumption is invisible: Dexie rebuilds indexes inside its own upgrade
 * transaction, so the only way to prove rows survive is to seed them at v14 and read them at v15.
 */
class TestV14Database extends Dexie {
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
        this.version(14).stores(SCHEMA_V14);
    }
}

/** Secondary index names of a store, sorted — `schema.indexes` excludes the primary key. */
function indexNames(db: LunaClairDatabase, store: string): string[] {
    return db
        .table(store)
        .schema.indexes.map((index) => index.name)
        .sort();
}

/** Every store touched by v15, with one seeded v14 row and its exact v15 index set. */
const STORES: Array<{ store: string; row: Record<string, unknown>; indexes: string[] }> = [
    {
        store: 'materials',
        row: {
            id: 'mat-1',
            documentId: 'doc-1',
            order: 1,
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
            lastOpenedAt: '2026-09-02T00:00:00.000Z',
            originShareId: 'pkg_share_1',
            tags: ['cardiology'],
        },
        indexes: [],
    },
    {
        store: 'questions',
        row: { id: 'q-1', materialId: 'mat-1', type: 'multiple_choice', difficulty: 'easy', version: 1, createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['materialId'],
    },
    {
        store: 'quizzes',
        row: { id: 'quiz-1', materialId: 'mat-1', createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['materialId'],
    },
    {
        store: 'quizSessions',
        row: { id: 'sess-1', quizId: 'quiz-1', mode: 'practice', status: 'completed', startedAt: '2026-09-01T00:00:00.000Z', completedAt: '2026-09-01T00:10:00.000Z' },
        indexes: ['quizId', 'status'],
    },
    {
        store: 'highlights',
        row: { id: 'hl-1', documentId: 'doc-1', createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['documentId'],
    },
    {
        store: 'drawings',
        row: { id: 'dr-1', documentId: 'doc-1', createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['documentId'],
    },
    {
        store: 'quizEditingDrafts',
        row: { draftId: 'draft-1', quizId: 'quiz-1', materialId: 'mat-1', updatedAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['materialId', 'quizId'],
    },
    {
        store: 'flashcardReviews',
        row: { key: 'mat-1:q-1', materialId: 'mat-1', dueAt: '2026-09-03T00:00:00.000Z', lastReviewedAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['materialId'],
    },
    {
        store: 'aiThreads',
        row: { id: 't-1', materialId: 'mat-1', title: 'Cardio', mode: 'assistant', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:05:00.000Z' },
        indexes: ['materialId', '[materialId+updatedAt]'],
    },
    {
        store: 'aiMessages',
        row: { id: 'm-1', threadId: 't-1', role: 'user', content: 'Why?', status: 'complete', createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['threadId', 'status', '[threadId+createdAt]'],
    },
    {
        store: 'syncQueue',
        row: {
            id: 'sq-1',
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-09-01T00:00:00.000Z',
            payload: { title: 'Doc' },
            status: 'pending',
            createdAt: '2026-09-01T00:00:00.000Z',
            retryCount: 0,
        },
        indexes: ['clientMutationId', 'entityType', 'status', '[status+createdAt]'],
    },
    {
        store: 'syncState',
        row: { key: 'usr-1:dev-1', userId: 'usr-1', deviceId: 'dev-1', lastServerCursor: 42, lastSyncedAt: '2026-09-01T00:00:00.000Z' },
        indexes: [],
    },
    {
        store: 'conflictDrafts',
        row: { id: 'cd-1', documentId: 'doc-1', baseVersion: 1, serverVersion: 2, localContent: '# local', serverContent: '# server', createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['documentId'],
    },
    {
        store: 'collections',
        row: { id: 'col-1', title: 'Cardio', order: 1, createdAt: '2026-09-01T00:00:00.000Z' },
        indexes: ['order'],
    },
    {
        store: 'collectionMaterials',
        row: { collectionId: 'col-1', materialId: 'mat-1', order: 1 },
        indexes: ['collectionId', 'materialId', '[collectionId+materialId]'],
    },
];

describe('Dexie Schema v15 — index-only pass', () => {
    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    afterEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    it('replaces every touched store index set while preserving all v14 rows', async () => {
        const v14Db = new TestV14Database();
        await v14Db.open();
        expect(v14Db.verno).toBe(14);

        for (const { store, row } of STORES) {
            await v14Db.table(store).bulkPut([row]);
        }
        v14Db.close();

        const db = new LunaClairDatabase();
        await db.open();
        expect(db.verno).toBeGreaterThanOrEqual(15);

        for (const { store, row, indexes } of STORES) {
            expect(await db.table(store).count(), `${store} rows preserved`).toBe(1);
            expect(indexNames(db, store), `${store} indexes`).toEqual([...indexes].sort());

            const stored = await db.table(store).toArray();
            expect(stored[0], `${store} row content`).toMatchObject(row);
        }

        // Untouched stores keep the index the pass relies on (`localAssets.materialId` is the
        // grouping read for a material's assets).
        expect(indexNames(db, 'localAssets')).toEqual(['materialId']);

        db.close();
    });

    it('serves the four bounded reads the pass added', async () => {
        const db = new LunaClairDatabase();
        await db.open();

        // syncQueue: `[status+createdAt]` yields pending items oldest-first, so a bounded drain
        // stops at the limit instead of materialising the backlog.
        await db.syncQueue.bulkPut([
            { id: 'sq-new', clientMutationId: 'm3', entityType: 'document', entityId: 'd', operation: 'UPSERT', clientTimestamp: '2026-09-01T03:00:00.000Z', payload: {}, status: 'pending', createdAt: '2026-09-01T03:00:00.000Z', retryCount: 0 },
            { id: 'sq-old', clientMutationId: 'm1', entityType: 'document', entityId: 'd', operation: 'UPSERT', clientTimestamp: '2026-09-01T01:00:00.000Z', payload: {}, status: 'pending', createdAt: '2026-09-01T01:00:00.000Z', retryCount: 0 },
            { id: 'sq-mid', clientMutationId: 'm2', entityType: 'document', entityId: 'd', operation: 'UPSERT', clientTimestamp: '2026-09-01T02:00:00.000Z', payload: {}, status: 'pending', createdAt: '2026-09-01T02:00:00.000Z', retryCount: 0 },
            { id: 'sq-failed', clientMutationId: 'm4', entityType: 'document', entityId: 'd', operation: 'UPSERT', clientTimestamp: '2026-09-01T00:00:00.000Z', payload: {}, status: 'failed', createdAt: '2026-09-01T00:00:00.000Z', retryCount: 1 },
        ]);

        const drained = await db.syncQueue
            .where('[status+createdAt]')
            .between(['pending', Dexie.minKey], ['pending', Dexie.maxKey])
            .limit(2)
            .toArray();
        expect(drained.map((item) => item.id)).toEqual(['sq-old', 'sq-mid']);

        // aiMessages: index-ordered per thread, other threads untouched.
        await db.aiMessages.bulkPut([
            { id: 'm-b', threadId: 't-a', role: 'assistant', content: 'second', status: 'complete', createdAt: '2026-09-01T00:02:00.000Z' },
            { id: 'm-a', threadId: 't-a', role: 'user', content: 'first', status: 'complete', createdAt: '2026-09-01T00:01:00.000Z' },
            { id: 'm-other', threadId: 't-b', role: 'user', content: 'other thread', status: 'complete', createdAt: '2026-09-01T00:00:30.000Z' },
        ]);

        const threadMessages = await db.aiMessages
            .where('[threadId+createdAt]')
            .between(['t-a', Dexie.minKey], ['t-a', Dexie.maxKey])
            .toArray();
        expect(threadMessages.map((message) => message.id)).toEqual(['m-a', 'm-b']);

        // aiThreads: most-recently-updated first within a material.
        await db.aiThreads.bulkPut([
            { id: 't-old', materialId: 'mat-1', title: 'Old', mode: 'assistant', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:01:00.000Z' },
            { id: 't-new', materialId: 'mat-1', title: 'New', mode: 'socratic', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:09:00.000Z' },
            { id: 't-global', title: 'Global', mode: 'assistant', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:10:00.000Z' },
        ]);

        const threads = await db.aiThreads
            .where('[materialId+updatedAt]')
            .between(['mat-1', Dexie.minKey], ['mat-1', Dexie.maxKey])
            .reverse()
            .toArray();
        expect(threads.map((thread) => thread.id)).toEqual(['t-new', 't-old']);

        // quizSessions.status replaces three full-store scans with a predicate.
        await db.quizSessions.bulkPut([
            { id: 'sess-done', quizId: 'quiz-1', mode: 'practice', status: 'completed', questionSnapshots: {}, answers: [], startedAt: '2026-09-01T00:00:00.000Z', completedAt: '2026-09-01T00:05:00.000Z' },
            { id: 'sess-open', quizId: 'quiz-1', mode: 'practice', status: 'in_progress', questionSnapshots: {}, answers: [], startedAt: '2026-09-01T00:00:00.000Z' },
        ]);

        const completed = await db.quizSessions.where('status').equals('completed').toArray();
        expect(completed.map((session) => session.id)).toEqual(['sess-done']);

        // A thread with no `materialId` is absent from the compound by definition (Dexie skips
        // records whose index key is `undefined`) — which is why that branch keeps its scan.
        const indexedThreads = await db.aiThreads
            .where('[materialId+updatedAt]')
            .between(['mat-1', Dexie.minKey], ['mat-1', Dexie.maxKey])
            .toArray();
        expect(indexedThreads.map((thread) => thread.id)).not.toContain('t-global');

        db.close();
    });

    it('no longer indexes the retired keys, so a stale call site fails loudly', async () => {
        const db = new LunaClairDatabase();
        await db.open();

        // Dexie raises SchemaError instead of falling back to a scan, and it raises it at execution
        // time — `where()` hands back a `WhereClause`, which has no `toArray` of its own, so the
        // comparison is what runs the query. This is exactly what a caller that still names a
        // retired index would hit, and why nothing may reference one.
        await expect(db.materials.where('lastOpenedAt').equals('2026-09-02T00:00:00.000Z').toArray()).rejects.toThrow(/not indexed/);
        await expect(db.materials.where('originShareId').equals('pkg_share_1').toArray()).rejects.toThrow(/not indexed/);
        await expect(db.syncState.where('userId').equals('usr-1').toArray()).rejects.toThrow(/not indexed/);
        await expect(db.syncQueue.where('entityId').equals('doc-1').toArray()).rejects.toThrow(/not indexed/);
        await expect(db.quizSessions.orderBy('completedAt').toArray()).rejects.toThrow(/not indexed/);

        db.close();
    });

    it('matches the SCHEMA_V15 definition for every store it touches', () => {
        expect(SCHEMA_V15.materials).toBe('id');
        expect(SCHEMA_V15.questions).toBe('id, materialId');
        expect(SCHEMA_V15.quizzes).toBe('id, materialId');
        expect(SCHEMA_V15.quizSessions).toBe('id, quizId, status');
        expect(SCHEMA_V15.highlights).toBe('id, documentId');
        expect(SCHEMA_V15.drawings).toBe('id, documentId');
        expect(SCHEMA_V15.quizEditingDrafts).toBe('draftId, quizId, materialId');
        expect(SCHEMA_V15.flashcardReviews).toBe('key, materialId');
        expect(SCHEMA_V15.aiThreads).toBe('id, materialId, [materialId+updatedAt]');
        expect(SCHEMA_V15.aiMessages).toBe('id, threadId, status, [threadId+createdAt]');
        expect(SCHEMA_V15.syncQueue).toBe('id, entityType, status, clientMutationId, [status+createdAt]');
        expect(SCHEMA_V15.syncState).toBe('key');
        expect(SCHEMA_V15.conflictDrafts).toBe('id, documentId');
        expect(SCHEMA_V15.collections).toBe('id, order');
        expect(SCHEMA_V15.collectionMaterials).toBe('++id, [collectionId+materialId], collectionId, materialId');
        // v14's asset rekey is carried through untouched.
        expect(SCHEMA_V15.localAssets).toBe('assetId, materialId');
    });
});
