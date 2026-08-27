import type { ConflictDraftRepository } from '../../../domain/sync/repositories/ConflictDraftRepository';
import type { ConflictDraft } from '../../../domain/sync/sync.types';
import { db as defaultDb, type LunaClairDatabase } from '../LunaClairDatabase';

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

    async removeConflictDraft(id: string): Promise<void> {
        await this.db.conflictDrafts.delete(id);
    }
}

/** Singleton instance of DexieConflictDraftRepository */
export const dexieConflictDraftRepository = new DexieConflictDraftRepository();
