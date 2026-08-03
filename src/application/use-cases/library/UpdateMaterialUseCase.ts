import type { StudyMaterial } from '../../../domain/library/StudyMaterial';
import type { LibraryRepository, UpdateMaterialInput } from '../../../domain/library/LibraryRepository';
import type { SubjectTermRepository } from '../../../domain/library/SubjectTermRepository';

export class UpdateMaterialUseCase {
    private readonly library: LibraryRepository; private readonly subjectTerms: SubjectTermRepository;
    constructor(library: LibraryRepository, subjectTerms: SubjectTermRepository) { this.library = library; this.subjectTerms = subjectTerms; }
    async execute(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
        const existing = await this.library.getMaterialById(id);
        if (!existing) throw new Error(`Material not found: ${id}`);
        const subjectId = input.subjectId === undefined ? existing.subjectId : input.subjectId ?? undefined;
        const termId = input.termId === undefined ? existing.termId : input.termId ?? undefined;
        if (termId) {
            if (!subjectId) throw new Error('subjectId is required when termId is set');
            if (!(await this.subjectTerms.hasTerm(subjectId, termId))) throw new Error(`Term "${termId}" is not linked to subject "${subjectId}"`);
        }
        return this.library.updateMaterial(id, input);
    }
}
