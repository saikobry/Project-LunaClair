import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { CreateMaterialInput, LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';

export class CreateMaterialUseCase {
    private readonly library: LibraryRepository;
    constructor(library: LibraryRepository) { this.library = library; }
    execute(input: CreateMaterialInput): Promise<StudyMaterial> { return this.library.createMaterial(input); }
}
