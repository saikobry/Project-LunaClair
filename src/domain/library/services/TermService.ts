import type { Term } from '../models/Term';
import type { SubjectTerm } from '../models/SubjectTerm';

export interface CreateAndAssignTermResult {
  term: Term;
  subjectTerm: SubjectTerm;
}

/**
 * Domain application service contract for term workflows that span
 * multiple aggregate repositories and must commit atomically.
 *
 * Implementations live in the infrastructure layer (e.g.
 * `DexieTermService`) and are supplied to feature hooks through the
 * `ApplicationContext` — domain and feature code never import Dexie
 * directly.
 */
export interface TermService {
  /**
   * Creates a new global Term and assigns it to the subject in a single
   * atomic transaction.
   *
   * The new term is appended with `max(order) + 1` for the subject and
   * the created `SubjectTerm` junction is returned alongside the Term.
   */
  createAndAssignTerm(subjectId: string, title: string): Promise<CreateAndAssignTermResult>;
}
