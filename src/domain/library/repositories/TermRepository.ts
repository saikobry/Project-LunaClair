import type { Term } from '../models/Term';

export interface CreateTermInput {
  title: string;
}

export interface UpdateTermInput {
  title?: string;
}

export interface TermRepository {
  getTerms(signal?: AbortSignal): Promise<Term[]>;
  getTermById(id: string, signal?: AbortSignal): Promise<Term | null>;
  createTerm(input: CreateTermInput): Promise<Term>;
  updateTerm(id: string, input: UpdateTermInput): Promise<Term>;
  deleteTerm(id: string): Promise<void>;
  /**
   * Idempotent bulk upsert by id (insert-or-overwrite). Used to sync
   * canonical default terms into local state — e.g. `SyncDefaultTermsUseCase`
   * writing `CANONICAL_DEFAULT_TERMS` after onboarding.
   */
  upsertTerms(terms: Term[]): Promise<void>;
}
