import { describe, expect, it, vi } from 'vitest';
import { ImportStudyPackageUseCase } from '../ImportStudyPackageUseCase';
import type { StudyPackageImportService } from '../../../../domain/package/services/StudyPackageImportService';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

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
                tags: ['biology', 'cells'],
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
        const importStudyPackage = vi.fn().mockResolvedValue(undefined);
        const mockImportService = {
            importStudyPackage,
        } as unknown as StudyPackageImportService;

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        const result = await useCase.execute({
            package: validPackage,
        });

        expect(mockImportService.importStudyPackage).toHaveBeenCalledTimes(1);
        expect(result.materialIds).toHaveLength(1);
        expect(result.questionIds).toHaveLength(1);
        expect(result.idMap.has('pkg_mat_1')).toBe(true);
        expect(result.idMap.has('pkg_q_1')).toBe(true);

        const committed = importStudyPackage.mock.calls[0][0];
        expect(committed.materials[0].originShareId).toBeUndefined();
        expect(committed.materials[0].tags).toEqual(['biology', 'cells']);
    });

    it('records originShareId on every imported material when provided', async () => {
        const importStudyPackage = vi.fn().mockResolvedValue(undefined);
        const mockImportService = {
            importStudyPackage,
        } as unknown as StudyPackageImportService;

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        await useCase.execute({
            package: validPackage,
            originShareId: 'share_abc123',
        });

        const committed = importStudyPackage.mock.calls[0][0];
        for (const material of committed.materials) {
            expect(material.originShareId).toBe('share_abc123');
        }
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
