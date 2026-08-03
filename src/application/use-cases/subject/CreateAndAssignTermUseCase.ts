import type { CreateAndAssignTermResult, TermService } from '../../../domain/library/TermService';
export class CreateAndAssignTermUseCase { private readonly terms: TermService; constructor(terms: TermService) { this.terms = terms; } execute(subjectId: string, title: string): Promise<CreateAndAssignTermResult> { return this.terms.createAndAssignTerm(subjectId, title); } }
