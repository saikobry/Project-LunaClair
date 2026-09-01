import { describe, expect, it, vi } from 'vitest';
import { DeleteSubjectUseCase } from '../DeleteSubjectUseCase';
import type { SubjectRepository } from '../../../../domain/library/SubjectRepository';
import type { LibraryRepository } from '../../../../domain/library/LibraryRepository';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';

describe('DeleteSubjectUseCase', () => {
    const matLinked: StudyMaterial = {
        id: 'mat-1',
        title: 'Notes',
        subjectId: 'sub-target',
        termId: 'term-1',
        documentId: 'doc-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const matOther: StudyMaterial = {
        id: 'mat-2',
        title: 'Other Notes',
        subjectId: 'sub-other',
        termId: 'term-1',
        documentId: 'doc-2',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('disassociates linked materials and deletes the subject', async () => {
        const mockLibrary: LibraryRepository = {
            getMaterials: vi.fn().mockResolvedValue([matLinked, matOther]),
            getMaterialById: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn().mockResolvedValue(matLinked),
            deleteMaterial: vi.fn(),
        };

        const mockSubjects: SubjectRepository = {
            deleteSubject: vi.fn().mockResolvedValue(undefined),
            getSubjects: vi.fn(),
            getSubjectById: vi.fn(),
            createSubject: vi.fn(),
            updateSubject: vi.fn(),
            reorderSubjects: vi.fn(),
        };

        const useCase = new DeleteSubjectUseCase(mockSubjects, mockLibrary);
        await useCase.execute('sub-target');

        expect(mockLibrary.updateMaterial).toHaveBeenCalledTimes(1);
        expect(mockLibrary.updateMaterial).toHaveBeenCalledWith('mat-1', { subjectId: null, termId: null });
        expect(mockSubjects.deleteSubject).toHaveBeenCalledWith('sub-target');
    });
});
