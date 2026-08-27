import type { ConflictDraft } from '../sync.types';

export interface ConflictDraftRepository {
  /**
   * Persists a newly created conflict draft for a diverged document.
   */
  saveConflictDraft(draft: ConflictDraft): Promise<void>;

  /**
   * Retrieves all conflict drafts for a specific document.
   */
  getByDocumentId(documentId: string): Promise<ConflictDraft[]>;

  /**
   * Retrieves a single conflict draft by its unique identifier.
   */
  getById(id: string): Promise<ConflictDraft | null>;

  /**
   * Retrieves all conflict drafts across all documents.
   */
  getAll(): Promise<ConflictDraft[]>;

  /**
   * Returns the count of all unresolved conflict drafts.
   */
  count(): Promise<number>;

  /**
   * Deletes a resolved or discarded conflict draft.
   */
  removeConflictDraft(id: string): Promise<void>;
}
