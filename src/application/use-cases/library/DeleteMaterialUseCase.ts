import type { LibraryRepository } from '../../../domain/library/LibraryRepository';
export class DeleteMaterialUseCase { private readonly library: LibraryRepository; constructor(library: LibraryRepository) { this.library = library; } execute(id: string): Promise<void> { return this.library.deleteMaterial(id); } }
