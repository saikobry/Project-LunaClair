import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
export class TouchMaterialUseCase { private readonly library: LibraryRepository; constructor(library: LibraryRepository) { this.library = library; } execute(id: string): Promise<StudyMaterial> { return this.library.updateMaterial(id, { lastOpenedAt: new Date().toISOString() }); } }
