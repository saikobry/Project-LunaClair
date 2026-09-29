import { describe, expect, it, vi } from 'vitest';
import { RemoveMaterialUseCase } from '../RemoveMaterialUseCase';
import type { LibraryImportService } from '../../../../domain/library/services/LibraryImportService';

describe('RemoveMaterialUseCase', () => {
    it('delegates deletion of local material, quiz content, and document to libraryImport service', async () => {
        const mockLibraryImport: LibraryImportService = {
            removeMaterial: vi.fn().mockResolvedValue(undefined),
        };

        const useCase = new RemoveMaterialUseCase(mockLibraryImport);
        await useCase.execute('mat-101');

        expect(mockLibraryImport.removeMaterial).toHaveBeenCalledWith('mat-101');
    });

    it('propagates error when local removal fails', async () => {
        const mockLibraryImport: LibraryImportService = {
            removeMaterial: vi.fn().mockRejectedValue(new Error('IndexedDB transaction failed')),
        };

        const useCase = new RemoveMaterialUseCase(mockLibraryImport);
        await expect(useCase.execute('mat-101')).rejects.toThrow('IndexedDB transaction failed');
    });
});
