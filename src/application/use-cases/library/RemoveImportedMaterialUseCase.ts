import type { LibraryImportService } from '../../../domain/library/services/LibraryImportService';

/**
 * Removes one material from the local library.
 *
 * Deletes the material row, its questions/quizzes, its locally imported
 * document content, and its stored binary assets (the imported original file
 * plus any package figures) from Dexie, atomically.
 *
 * Strictly a local operation: published shares stay on the server, so the
 * material can be cloned again from the Explore hub.
 */
export class RemoveImportedMaterialUseCase {
    private readonly libraryImport: LibraryImportService;

    constructor(libraryImport: LibraryImportService) {
        this.libraryImport = libraryImport;
    }

    execute(materialId: string): Promise<void> {
        return this.libraryImport.removeImportedMaterial(materialId);
    }
}
