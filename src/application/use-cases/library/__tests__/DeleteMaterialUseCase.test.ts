import { describe, expect, it, vi } from 'vitest';
import { DeleteMaterialUseCase } from '../DeleteMaterialUseCase';
import type { LibraryRepository } from '../../../../domain/library/LibraryRepository';

describe('DeleteMaterialUseCase', () => {
    it('delegates deletion to LibraryRepository', async () => {
        const mockRepo: LibraryRepository = {
            deleteMaterial: vi.fn().mockResolvedValue(undefined),
            getMaterials: vi.fn(),
            getMaterialById: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
        };

        const useCase = new DeleteMaterialUseCase(mockRepo);
        await useCase.execute('mat-101');

        expect(mockRepo.deleteMaterial).toHaveBeenCalledWith('mat-101');
    });
});
