import type { SubjectTermRepository } from '../../../domain/library/SubjectTermRepository';
export class RemoveTermFromSubjectUseCase { private readonly subjectTerms: SubjectTermRepository; constructor(subjectTerms: SubjectTermRepository) { this.subjectTerms = subjectTerms; } execute(subjectId: string, termId: string): Promise<void> { return this.subjectTerms.removeTerm(subjectId, termId); } }
