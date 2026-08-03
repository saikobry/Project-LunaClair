import type { Term } from './Term';
import type { SubjectTermView } from './SubjectTerm';

export interface SubjectTermRepository {
  getTermsBySubject(subjectId: string, signal?: AbortSignal): Promise<Term[]>;
  getSubjectTermViews(subjectId: string, signal?: AbortSignal): Promise<SubjectTermView[]>;
  getSubjectIdsByTerm(termId: string, signal?: AbortSignal): Promise<string[]>;
  syncTerms(subjectId: string, termIds: string[]): Promise<void>;
  reorderTerms(subjectId: string, orderedTermIds: string[]): Promise<void>;
  addTerm(subjectId: string, termId: string): Promise<void>;
  removeTerm(subjectId: string, termId: string): Promise<void>;
  hasTerm(subjectId: string, termId: string): Promise<boolean>;
}
