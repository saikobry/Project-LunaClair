import type { TermRepository, UpdateTermInput } from '../../../domain/library/repositories/TermRepository';
import type { Term } from '../../../domain/library/models/Term';

export class UpdateTermUseCase {
    private readonly terms: TermRepository;

    constructor(terms: TermRepository) {
        this.terms = terms;
    }

    execute(id: string, input: UpdateTermInput): Promise<Term> {
        return this.terms.updateTerm(id, input);
    }
}
