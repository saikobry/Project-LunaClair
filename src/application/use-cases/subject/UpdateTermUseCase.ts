import type { TermRepository, UpdateTermInput } from '../../../domain/library/TermRepository';
import type { Term } from '../../../domain/library/Term';

export class UpdateTermUseCase {
    private readonly terms: TermRepository;

    constructor(terms: TermRepository) {
        this.terms = terms;
    }

    execute(id: string, input: UpdateTermInput): Promise<Term> {
        return this.terms.updateTerm(id, input);
    }
}
