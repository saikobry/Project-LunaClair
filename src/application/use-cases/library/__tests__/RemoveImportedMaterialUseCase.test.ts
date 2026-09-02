import { describe, expect, it, vi } from 'vitest';
import { RemoveImportedMaterialUseCase } from '../RemoveImportedMaterialUseCase';
import type { LibraryImportService } from '../../../../domain/library/services/LibraryImportService';

describe('RemoveImportedMaterialUseCase', () => {
    it('delegates deletion of local material, quiz content, and document to libraryImport service', async () => {
        const mockLibraryImport: LibraryImportService = {
            importMaterial: vi.fn(),
            importMaterialBatch: vi.fn(),
            removeImportedMaterial: vi.fn().mockResolvedValue(undefined),
        };

        const useCase = new RemoveImportedMaterialUseCase(mockLibraryImport);
        await useCase.execute('mat-101');

        expect(mockLibraryImport.removeImportedMaterial).toHaveBeenCalledWith('mat-101');
    });

    it('propagates error when local removal fails', async () => {
        const mockLibraryImport: LibraryImportService = {
            importMaterial: vi.fn(),
            importMaterialBatch: vi.fn(),
            removeImportedMaterial: vi.fn().mockRejectedValue(new Error('IndexedDB transaction failed')),
        };

        const useCase = new RemoveImportedMaterialUseCase(mockLibraryImport);
        await expect(useCase.execute('mat-101')).rejects.toThrow('IndexedDB transaction failed');
    });
});
