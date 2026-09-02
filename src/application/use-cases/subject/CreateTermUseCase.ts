import type { CreateTermInput, TermRepository } from '../../../domain/library/repositories/TermRepository';
import type { Term } from '../../../domain/library/models/Term';

export class CreateTermUseCase {
    private readonly terms: TermRepository;

    constructor(terms: TermRepository) {
        this.terms = terms;
    }

    execute(input: CreateTermInput): Promise<Term> {
        return this.terms.createTerm(input);
    }
}
