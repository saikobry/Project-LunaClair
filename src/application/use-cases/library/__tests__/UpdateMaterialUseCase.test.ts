import { describe, expect, it, vi } from 'vitest';
import { UpdateMaterialUseCase } from '../UpdateMaterialUseCase';
import type { LibraryRepository } from '../../../../domain/library/LibraryRepository';
import type { SubjectTermRepository } from '../../../../domain/library/SubjectTermRepository';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';

describe('UpdateMaterialUseCase', () => {
    const existingMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Notes',
        subjectId: 'sub-1',
        termId: 'term-1',
        documentId: 'doc-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createServices = (material: StudyMaterial | null = existingMaterial, isLinked = true) => {
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

    it('updates material fields when association is valid', async () => {
        const { library, subjectTerms } = createServices(existingMaterial, true);
        const useCase = new UpdateMaterialUseCase(library, subjectTerms);

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
        const { library, subjectTerms } = createServices(null);
        const useCase = new UpdateMaterialUseCase(library, subjectTerms);

        await expect(
            useCase.execute('mat-missing', { title: 'New Title' }),
        ).rejects.toThrow('Material not found: mat-missing');
        expect(library.updateMaterial).not.toHaveBeenCalled();
    });

    it('validates new termId against existing subjectId', async () => {
        const { library, subjectTerms } = createServices(existingMaterial, false);
        const useCase = new UpdateMaterialUseCase(library, subjectTerms);

        await expect(
            useCase.execute('mat-1', { termId: 'term-unlinked' }),
        ).rejects.toThrow('Term "term-unlinked" is not linked to subject "sub-1"');
        expect(library.updateMaterial).not.toHaveBeenCalled();
    });
});
