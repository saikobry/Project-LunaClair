import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { LibraryRepository, UpdateMaterialInput } from '../../../domain/library/repositories/LibraryRepository';

export class UpdateMaterialUseCase {
    private readonly library: LibraryRepository;
    constructor(library: LibraryRepository) { this.library = library; }
    async execute(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
        const existing = await this.library.getMaterialById(id);
        if (!existing) throw new Error(`Material not found: ${id}`);
        return this.library.updateMaterial(id, input);
    }
}
