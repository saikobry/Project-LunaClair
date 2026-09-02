import type { TermRepository } from '../../../domain/library/repositories/TermRepository';
export class DeleteTermUseCase { private readonly terms: TermRepository; constructor(terms: TermRepository) { this.terms = terms; } execute(termId: string): Promise<void> { return this.terms.deleteTerm(termId); } }
