import { describe, expect, it, vi } from 'vitest';
import { ImportStudyPackageUseCase } from '../ImportStudyPackageUseCase';
import type { StudyPackageImportService } from '../../../../domain/package/StudyPackageImportService';
import type { StudyPackage } from '../../../../domain/package/package.types';

describe('ImportStudyPackageUseCase', () => {
    const validPackage: StudyPackage = {
        format: 'lcpack',
        schemaVersion: 1,
        metadata: {
            title: 'Cell Biology Pack',
            createdAt: '2026-09-01T00:00:00.000Z',
        },
        materials: [
            {
                id: 'pkg_mat_1',
                title: 'Cell Notes',
                documentContent: '# Cells\nBasic unit of life.',
            },
        ],
        questions: [
            {
                id: 'pkg_q_1',
                materialId: 'pkg_mat_1',
                type: 'true_false',
                prompt: 'Cells have membranes.',
                payload: { type: 'true_false', correctAnswer: true },
                points: 1,
                difficulty: 'easy',
            },
        ],
        quizzes: [],
    };

    it('validates, remaps IDs, and delegates atomic persistence to StudyPackageImportService', async () => {
        const mockImportService: StudyPackageImportService = {
            importStudyPackage: vi.fn().mockResolvedValue(undefined),
        };

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        const result = await useCase.execute({
            package: validPackage,
            targetSubjectId: 'sub-bio',
            targetTermId: 'term-prelim',
        });

        expect(mockImportService.importStudyPackage).toHaveBeenCalledTimes(1);
        expect(result.materialIds).toHaveLength(1);
        expect(result.questionIds).toHaveLength(1);
        expect(result.idMap.has('pkg_mat_1')).toBe(true);
        expect(result.idMap.has('pkg_q_1')).toBe(true);
    });

    it('rejects invalid package before storage is touched', async () => {
        const mockImportService: StudyPackageImportService = {
            importStudyPackage: vi.fn(),
        };

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        const invalidPackage = {
            format: 'invalid-format',
            schemaVersion: 99,
        };

        await expect(useCase.execute({ package: invalidPackage })).rejects.toThrow(
            /StudyPackage validation failed/i,
        );

        expect(mockImportService.importStudyPackage).not.toHaveBeenCalled();
    });
});
