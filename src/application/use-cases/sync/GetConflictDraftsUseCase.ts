import type { ConflictDraft } from '../../../domain/sync/models/sync.types';
import type { ConflictDraftRepository } from '../../../domain/sync/repositories/ConflictDraftRepository';

export interface GetConflictDraftsInput {
  documentId?: string;
}

/**
 * Retrieves unresolved document conflict drafts, optionally filtered by a specific documentId.
 */
export class GetConflictDraftsUseCase {
  private readonly conflictDraftRepo: ConflictDraftRepository;

  constructor(conflictDraftRepo: ConflictDraftRepository) {
    this.conflictDraftRepo = conflictDraftRepo;
  }

  async execute(input?: string | GetConflictDraftsInput): Promise<ConflictDraft[]> {
    const documentId = typeof input === 'string' ? input : input?.documentId;
    if (documentId) {
      return await this.conflictDraftRepo.getByDocumentId(documentId);
    }
    return await this.conflictDraftRepo.getAll();
  }
}
