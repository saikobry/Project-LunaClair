import type { LunaClairDatabase } from '../../../infrastructure/database/LunaClairDatabase';
import type { ConflictDraftRepository } from '../../../domain/sync';
import { runSyncableTransaction } from '../../../infrastructure/database/sync/transactionalOutbox';

export interface ResolveConflictDraftInput {
  draftId: string;
  resolution: 'keep_server' | 'keep_local' | 'merge';
  mergedContent?: string;
}

/**
 * Resolves a diverged document conflict draft by choosing server state, local state,
 * or a manual merge, atomically updating local document content and queuing an outbox mutation.
 */
export class ResolveConflictDraftUseCase {
  private readonly db: LunaClairDatabase;
  private readonly conflictDraftRepo: ConflictDraftRepository;

  constructor(db: LunaClairDatabase, conflictDraftRepo: ConflictDraftRepository) {
    this.db = db;
    this.conflictDraftRepo = conflictDraftRepo;
  }

  async execute(input: ResolveConflictDraftInput): Promise<void> {
    const { draftId, resolution, mergedContent } = input;

    if (!draftId) {
      throw new Error('draftId is required to resolve conflict');
    }

    if (resolution === 'keep_server') {
      await this.conflictDraftRepo.removeConflictDraft(draftId);
      return;
    }

    // resolution === 'keep_local' | 'merge'
    const draft = await this.conflictDraftRepo.getById(draftId);
    if (!draft) {
      throw new Error(`Conflict draft with ID ${draftId} not found`);
    }

    const content = resolution === 'merge' ? (mergedContent ?? draft.localContent) : draft.localContent;
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

    await this.conflictDraftRepo.removeConflictDraft(draftId);
  }
}
