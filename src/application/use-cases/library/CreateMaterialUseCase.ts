import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { CreateMaterialInput, LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
import type { SubjectTermRepository } from '../../../domain/library/repositories/SubjectTermRepository';

async function validateAssociation(input: { subjectId?: string; termId?: string }, subjectTerms: SubjectTermRepository) {
    if (!input.termId) return;
    if (!input.subjectId) throw new Error('subjectId is required when termId is set');
    if (!(await subjectTerms.hasTerm(input.subjectId, input.termId))) throw new Error(`Term "${input.termId}" is not linked to subject "${input.subjectId}"`);
}

export class CreateMaterialUseCase {
    private readonly library: LibraryRepository; private readonly subjectTerms: SubjectTermRepository;
    constructor(library: LibraryRepository, subjectTerms: SubjectTermRepository) { this.library = library; this.subjectTerms = subjectTerms; }
    async execute(input: CreateMaterialInput): Promise<StudyMaterial> { await validateAssociation(input, this.subjectTerms); return this.library.createMaterial(input); }
}
