import type { ConflictDraftRepository, ResolveConflictInput } from '../../../domain/sync/repositories/ConflictDraftRepository';
import type { ConflictDraft } from '../../../domain/sync/models/sync.types';
import { db as defaultDb, type LunaClairDatabase } from '../LunaClairDatabase';
import { runSyncableTransaction } from './transactionalOutbox';

/**
 * Dexie-backed implementation of `ConflictDraftRepository` for diverged document drafts.
 */
export class DexieConflictDraftRepository implements ConflictDraftRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = defaultDb) {
        this.db = database;
    }

    async saveConflictDraft(draft: ConflictDraft): Promise<void> {
        await this.db.conflictDrafts.put(draft);
    }

    async getByDocumentId(documentId: string): Promise<ConflictDraft[]> {
        return await this.db.conflictDrafts.where('documentId').equals(documentId).toArray();
    }

    async getById(id: string): Promise<ConflictDraft | null> {
        const draft = await this.db.conflictDrafts.get(id);
        return draft ?? null;
    }

    async getAll(): Promise<ConflictDraft[]> {
        return await this.db.conflictDrafts.toArray();
    }

    async count(): Promise<number> {
        return await this.db.conflictDrafts.count();
    }

    async removeConflictDraft(id: string): Promise<void> {
        await this.db.conflictDrafts.delete(id);
    }

    async resolveConflict(input: ResolveConflictInput): Promise<void> {
        const { draftId, resolution } = input;

        if (resolution === 'keep_server') {
            await this.removeConflictDraft(draftId);
            return;
        }

        const draft = await this.getById(draftId);
        if (!draft) {
            throw new Error(`Conflict draft with ID ${draftId} not found`);
        }

        const content = resolution === 'merge' ? input.mergedContent : draft.localContent;
        const now = new Date().toISOString();
        const nextVersion = draft.serverVersion + 1;

        await runSyncableTransaction(
            this.db,
            [this.db.documentContents],
            {
                entityType: 'document',
                entityId: draft.documentId,
                operation: 'UPSERT',
                baseVersion: draft.serverVersion,
                payload: {
                    documentId: draft.documentId,
                    title: draft.documentId,
                    content,
                    updatedAt: now,
                    version: nextVersion,
                },
            },
            async () => {
                const existing = await this.db.documentContents.get(draft.documentId);
                const title = existing?.title ?? draft.documentId;
                await this.db.documentContents.put({
                    documentId: draft.documentId,
                    title,
                    content,
                    updatedAt: now,
                    version: nextVersion,
                });
            }
        );

        await this.removeConflictDraft(draftId);
    }
}

/** Singleton instance of DexieConflictDraftRepository */
export const dexieConflictDraftRepository = new DexieConflictDraftRepository();
