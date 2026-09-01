import { describe, expect, it, vi } from 'vitest';
import { CreateMaterialUseCase } from '../CreateMaterialUseCase';
import type { LibraryRepository, CreateMaterialInput } from '../../../../domain/library/LibraryRepository';
import type { SubjectTermRepository } from '../../../../domain/library/SubjectTermRepository';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';

describe('CreateMaterialUseCase', () => {
    const mockMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Notes',
        subjectId: 'sub-1',
        termId: 'term-1',
        documentId: 'doc-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createServices = (isLinked = true) => {
        const library: LibraryRepository = {
            createMaterial: vi.fn().mockResolvedValue(mockMaterial),
            getMaterials: vi.fn(),
            getMaterialById: vi.fn(),
            updateMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const subjectTerms: SubjectTermRepository = {
            hasTerm: vi.fn().mockResolvedValue(isLinked),
            getTermsBySubject: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            syncTerms: vi.fn(),
            reorderTerms: vi.fn(),
            addTerm: vi.fn(),
            removeTerm: vi.fn(),
        };

        return { library, subjectTerms };
    };

    it('creates a study material when subject-term association is valid', async () => {
        const { library, subjectTerms } = createServices(true);
        const useCase = new CreateMaterialUseCase(library, subjectTerms);

        const input: CreateMaterialInput = {
            title: 'Cell Notes',
            subjectId: 'sub-1',
            termId: 'term-1',
            documentId: 'doc-1',
        };

        const result = await useCase.execute(input);

        expect(subjectTerms.hasTerm).toHaveBeenCalledWith('sub-1', 'term-1');
        expect(library.createMaterial).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockMaterial);
    });

    it('creates a unassigned study material when termId is not provided', async () => {
        const { library, subjectTerms } = createServices();
        const useCase = new CreateMaterialUseCase(library, subjectTerms);

        const input: CreateMaterialInput = {
            title: 'Standalone Note',
            documentId: 'doc-standalone',
        };

        await useCase.execute(input);

        expect(subjectTerms.hasTerm).not.toHaveBeenCalled();
        expect(library.createMaterial).toHaveBeenCalledWith(input);
    });

    it('rejects when termId is set but subjectId is missing', async () => {
        const { library, subjectTerms } = createServices();
        const useCase = new CreateMaterialUseCase(library, subjectTerms);

        const input: CreateMaterialInput = {
            title: 'Orphaned Term Note',
            termId: 'term-1',
            documentId: 'doc-1',
        };

        await expect(useCase.execute(input)).rejects.toThrow('subjectId is required when termId is set');
        expect(library.createMaterial).not.toHaveBeenCalled();
    });

    it('rejects when term is not linked to the subject', async () => {
        const { library, subjectTerms } = createServices(false); // not linked
        const useCase = new CreateMaterialUseCase(library, subjectTerms);

        const input: CreateMaterialInput = {
            title: 'Mismatched Note',
            subjectId: 'sub-1',
            termId: 'term-unlinked',
            documentId: 'doc-1',
        };

        await expect(useCase.execute(input)).rejects.toThrow('Term "term-unlinked" is not linked to subject "sub-1"');
        expect(library.createMaterial).not.toHaveBeenCalled();
    });
});
