import type { Term } from './Term';

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
}
