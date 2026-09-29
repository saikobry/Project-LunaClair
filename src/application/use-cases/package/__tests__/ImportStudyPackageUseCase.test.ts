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

    it('rejects a package whose cloze markers disagree with its answers, before storage is touched', async () => {
        const importStudyPackage = vi.fn().mockResolvedValue(undefined);
        const mockImportService = {
            importStudyPackage,
        } as unknown as StudyPackageImportService;

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        // Two `___` markers, one answer. The projection would degrade this to a single
        // whole-question card with an answer the learner is never tested on, so it is refused
        // rather than imported and reported.
        const malformedPackage: StudyPackage = {
            ...validPackage,
            questions: [
                {
                    id: 'pkg_q_broken_cloze',
                    materialId: 'pkg_mat_1',
                    type: 'fill_in_blank',
                    prompt: 'Fill in the blanks.',
                    payload: {
                        type: 'fill_in_blank',
                        template: 'The ___ is the ___ of the cell.',
                        blanks: ['nucleus'],
                    },
                    difficulty: 'medium',
                    points: 1,
                },
            ],
        };

        await expect(useCase.execute({ package: malformedPackage })).rejects.toThrow(
            /exactly one answer per "___" placeholder \(2 in template, 1 supplied\)/,
        );

        // Nothing partial landed: the refusal is before the transaction, not a rollback of it.
        expect(importStudyPackage).not.toHaveBeenCalled();
    });

    it('rejects a package whose identification answer is empty, before storage is touched', async () => {
        const importStudyPackage = vi.fn().mockResolvedValue(undefined);
        const mockImportService = {
            importStudyPackage,
        } as unknown as StudyPackageImportService;

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        await expect(
            useCase.execute({
                package: {
                    ...validPackage,
                    questions: [
                        {
                            id: 'pkg_q_broken_ident',
                            materialId: 'pkg_mat_1',
                            type: 'identification',
                            prompt: 'Name the organelle.',
                            payload: { type: 'identification', correctAnswer: '' },
                            difficulty: 'medium',
                            points: 1,
                        },
                    ],
                },
            }),
        ).rejects.toThrow(/requires a non-empty "correctAnswer" string/);

        expect(importStudyPackage).not.toHaveBeenCalled();
    });

    it('imports a structurally valid package, so every persisted payload is readable', async () => {
        const importStudyPackage = vi.fn().mockResolvedValue(undefined);
        const mockImportService = {
            importStudyPackage,
        } as unknown as StudyPackageImportService;

        const useCase = new ImportStudyPackageUseCase(mockImportService);

        const result = await useCase.execute({ package: validPackage });

        expect(importStudyPackage).toHaveBeenCalledTimes(1);
        expect(result.questionIds).toHaveLength(1);
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
