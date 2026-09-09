import { describe, expect, it, vi } from 'vitest';
import { UpdateMaterialUseCase } from '../UpdateMaterialUseCase';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('UpdateMaterialUseCase', () => {
    const existingMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Notes',
        documentId: 'doc-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createServices = (material: StudyMaterial | null = existingMaterial) => {
        const library: LibraryRepository = {
            getMaterialById: vi.fn().mockResolvedValue(material),
            updateMaterial: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...existingMaterial,
                    id,
                    ...input,
                    updatedAt: '2026-09-01T12:00:00.000Z',
                }),
            ),
            getMaterials: vi.fn(),
            createMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        return { library };
    };

    it('updates material fields', async () => {
        const { library } = createServices(existingMaterial);
        const useCase = new UpdateMaterialUseCase(library);

        const result = await useCase.execute('mat-1', {
            title: 'Updated Cell Biology Notes',
        });

        expect(library.getMaterialById).toHaveBeenCalledWith('mat-1');
        expect(library.updateMaterial).toHaveBeenCalledWith('mat-1', {
            title: 'Updated Cell Biology Notes',
        });
        expect(result.title).toBe('Updated Cell Biology Notes');
    });

    it('throws error when material does not exist', async () => {
        const { library } = createServices(null);
        const useCase = new UpdateMaterialUseCase(library);

        await expect(
            useCase.execute('mat-missing', { title: 'New Title' }),
        ).rejects.toThrow('Material not found: mat-missing');
        expect(library.updateMaterial).not.toHaveBeenCalled();
    });
});
