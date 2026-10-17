import type { ConflictDraftRepository, ResolveConflictInput } from '../../../domain/sync/repositories/ConflictDraftRepository';
import type { ConflictDraft } from '../../../domain/sync/models/sync.types';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { withOrigin } from '../sync/transactionContext';

/**
 * Dexie-backed implementation of `ConflictDraftRepository` for diverged document drafts.
 */
export class DexieConflictDraftRepository implements ConflictDraftRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
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

        await withOrigin(
            this.db,
            'local',
            [this.db.documentContents, this.db.syncQueue, this.db.tombstones, this.db.conflictDrafts],
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
                await this.db.conflictDrafts.delete(draftId);
            }
        );
    }
}

/** Singleton instance of DexieConflictDraftRepository */
export const dexieConflictDraftRepository = new DexieConflictDraftRepository();
