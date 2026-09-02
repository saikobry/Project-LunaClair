import type { LibraryImportService } from '../../../domain/library/services/LibraryImportService';

/**
 * Removes one material from the local library.
 *
 * Deletes the material row, its questions/quizzes, and its locally imported
 * document content from Dexie. The canonical D1 catalog entry is untouched —
 * "Remove from Library" is strictly a local operation, and the material stays
 * available in the remote catalog for re-import.
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
