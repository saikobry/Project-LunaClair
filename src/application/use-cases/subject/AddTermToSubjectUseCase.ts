import type { SubjectTermRepository } from '../../../domain/library/SubjectTermRepository';
export class AddTermToSubjectUseCase { private readonly subjectTerms: SubjectTermRepository; constructor(subjectTerms: SubjectTermRepository) { this.subjectTerms = subjectTerms; } execute(subjectId: string, termId: string): Promise<void> { return this.subjectTerms.addTerm(subjectId, termId); } }
