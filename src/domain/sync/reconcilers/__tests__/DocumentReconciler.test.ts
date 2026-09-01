import { describe, expect, it } from 'vitest';
import { reconcileDocument } from '../DocumentReconciler';
import type { DocumentSyncPayload } from '../../SyncEntities';
import type { SyncQueueItem } from '../../sync.types';

describe('DocumentReconciler (Model C: Optimistic Concurrency & Conflict Branching)', () => {
    const remoteDoc: DocumentSyncPayload = {
        documentId: 'doc-1',
        title: 'Cellular Respiration',
        content: '# Remote Server Content',
        version: 3,
        updatedAt: '2026-09-01T12:00:00.000Z',
    };

    it('applies remote document when local state has no pending unpushed outbox mutations', () => {
        const result = reconcileDocument(
            { documentId: 'doc-1', content: '# Old Local Content', version: 2 },
            remoteDoc,
            null,
        );

        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
            expect(result.document).toEqual(remoteDoc);
        }
    });

    it('applies remote document when unpushed local mutation has identical content to server', () => {
        const unpushed: SyncQueueItem<unknown> = {
            id: 'item-1',
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-09-01T12:01:00.000Z',
            payload: { content: '# Remote Server Content' },
            baseVersion: 2,
            createdAt: '2026-09-01T12:01:00.000Z',
            retryCount: 0,
            status: 'pending',
        };

        const result = reconcileDocument(
            { documentId: 'doc-1', content: '# Remote Server Content' },
            remoteDoc,
            unpushed,
        );

        expect(result.kind).toBe('apply');
    });

    it('returns compatible when unpushed local mutation is cleanly based on remote version', () => {
        const unpushed: SyncQueueItem<unknown> = {
            id: 'item-1',
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-09-01T12:01:00.000Z',
            payload: { content: '# Local Edit On Top of V3' },
            baseVersion: 3, // Matches remote version 3
            createdAt: '2026-09-01T12:01:00.000Z',
            retryCount: 0,
            status: 'pending',
        };

        const result = reconcileDocument(
            { documentId: 'doc-1', content: '# Local Edit On Top of V3' },
            remoteDoc,
            unpushed,
        );

        expect(result.kind).toBe('compatible');
    });

    it('branches a ConflictDraft when concurrent edits diverge from different base versions', () => {
        const unpushed: SyncQueueItem<unknown> = {
            id: 'item-1',
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-09-01T12:01:00.000Z',
            payload: { content: '# Local Divergent Edit' },
            baseVersion: 1, // Diverged: based on V1, but server is at V3
            createdAt: '2026-09-01T12:01:00.000Z',
            retryCount: 0,
            status: 'pending',
        };

        const result = reconcileDocument(
            { documentId: 'doc-1', content: '# Local Divergent Edit' },
            remoteDoc,
            unpushed,
        );

        expect(result.kind).toBe('conflict');
        if (result.kind === 'conflict') {
            expect(result.canonicalServerDoc).toEqual(remoteDoc);
            expect(result.draft.documentId).toBe('doc-1');
            expect(result.draft.baseVersion).toBe(1);
            expect(result.draft.serverVersion).toBe(3);
            expect(result.draft.localContent).toBe('# Local Divergent Edit');
            expect(result.draft.serverContent).toBe('# Remote Server Content');
        }
    });
});
