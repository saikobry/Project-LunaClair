import { describe, expect, it, vi } from 'vitest';
import { CreateMaterialUseCase } from '../CreateMaterialUseCase';
import type { LibraryRepository, CreateMaterialInput } from '../../../../domain/library/repositories/LibraryRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('CreateMaterialUseCase', () => {
    const mockMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Notes',
        documentId: 'doc-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createServices = () => {
        const library: LibraryRepository = {
            createMaterial: vi.fn().mockResolvedValue(mockMaterial),
            getMaterials: vi.fn(),
            getMaterialById: vi.fn(),
            updateMaterial: vi.fn(),
        };

        return { library };
    };

    it('creates a study material and delegates to the repository', async () => {
        const { library } = createServices();
        const useCase = new CreateMaterialUseCase(library);

        const input: CreateMaterialInput = {
            title: 'Cell Notes',
            documentId: 'doc-1',
        };

        const result = await useCase.execute(input);

        expect(library.createMaterial).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockMaterial);
    });

    it('creates a study material with tags', async () => {
        const { library } = createServices();
        const useCase = new CreateMaterialUseCase(library);

        const input: CreateMaterialInput = {
            title: 'Standalone Note',
            documentId: 'doc-standalone',
            tags: ['biology'],
        };

        await useCase.execute(input);

        expect(library.createMaterial).toHaveBeenCalledWith(input);
    });
});
