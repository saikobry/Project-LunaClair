import type { ConflictDraft } from '../models/sync.types';

export type ResolveConflictInput =
  | {
      draftId: string;
      resolution: 'keep_server';
    }
  | {
      draftId: string;
      resolution: 'keep_local';
    }
  | {
      draftId: string;
      resolution: 'merge';
      mergedContent: string;
    };

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

  /**
   * Resolves a diverged document conflict draft atomically.
   */
  resolveConflict(input: ResolveConflictInput): Promise<void>;
}
