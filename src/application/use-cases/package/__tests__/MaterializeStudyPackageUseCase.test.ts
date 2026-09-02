import { describe, expect, it, vi } from 'vitest';
import { MaterializeStudyPackageUseCase } from '../MaterializeStudyPackageUseCase';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentContentRepository } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { QuestionRepository } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../../../domain/quiz/repositories/QuizRepository';
import type { ImportAssetRepository } from '../../../../domain/importer/repositories/ImportAssetRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

describe('MaterializeStudyPackageUseCase', () => {
    const mockMaterial: StudyMaterial = {
        id: 'mat-local-1',
        title: 'Cell Biology Notes',
        description: 'Comprehensive study guide',
        documentId: 'doc-local-1',
        subjectId: 'sub-bio',
        termId: 'term-prelim',
        order: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockQuestion: Question = {
        id: 'q-local-1',
        materialId: 'mat-local-1',
        type: 'multiple_choice',
        prompt: 'What organelle synthesizes ATP?',
        payload: {
            type: 'multiple_choice',
            choices: ['Mitochondria', 'Ribosome', 'Nucleus'],
            correctIndex: 0,
        },
        points: 5,
        difficulty: 'medium',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockQuiz: Quiz = {
        id: 'quiz-local-1',
        materialId: 'mat-local-1',
        title: 'Cell Quiz',
        status: 'published',
        questionIds: ['q-local-1'],
        items: [
            {
                quizId: 'quiz-local-1',
                questionId: 'q-local-1',
                questionVersion: 1,
                order: 1,
                points: 5,
            },
        ],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('materializes package graph with stripped IDs rewritten to pkg_* format', async () => {
        const mockLibrary: LibraryRepository = {
            getMaterialById: vi.fn().mockResolvedValue(mockMaterial),
            getMaterials: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const mockDocContent: DocumentContentRepository = {
            getByDocumentId: vi.fn().mockResolvedValue({
                documentId: 'doc-local-1',
                title: 'Cell Biology Notes',
                content: '# Chapter 1\nCells are life.',
                updatedAt: '2026-09-01T00:00:00.000Z',
            }),
            put: vi.fn(),
            deleteByDocumentId: vi.fn(),
        };

        const mockQuestions: QuestionRepository = {
            getQuestions: vi.fn().mockResolvedValue([mockQuestion]),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const mockQuizzes: QuizRepository = {
            getQuizzes: vi.fn().mockResolvedValue([mockQuiz]),
            getQuizById: vi.fn(),
            getQuizzesForMaterials: vi.fn(),
            getQuizzesByIds: vi.fn(),
            createQuiz: vi.fn(),
            updateQuiz: vi.fn(),
            deleteQuiz: vi.fn(),
        };

        const mockAssets: ImportAssetRepository = {
            get: vi.fn().mockResolvedValue(undefined),
            put: vi.fn(),
            delete: vi.fn(),
        };

        const useCase = new MaterializeStudyPackageUseCase(
            mockLibrary,
            mockDocContent,
            mockQuestions,
            mockQuizzes,
            mockAssets,
        );

        const pkg = await useCase.execute({ materialId: 'mat-local-1', author: 'Test Author' });

        expect(pkg.format).toBe('lcpack');
        expect(pkg.schemaVersion).toBe(1);
        expect(pkg.metadata.title).toBe('Cell Biology Notes');
        expect(pkg.metadata.author).toBe('Test Author');

        expect(pkg.materials).toHaveLength(1);
        expect(pkg.materials[0].id).toBe('pkg_mat_1');
        expect(pkg.materials[0].documentContent).toBe('# Chapter 1\nCells are life.');

        expect(pkg.questions).toHaveLength(1);
        expect(pkg.questions[0].id).toBe('pkg_q_1');
        expect(pkg.questions[0].materialId).toBe('pkg_mat_1');

        expect(pkg.quizzes).toHaveLength(1);
        expect(pkg.quizzes[0].id).toBe('pkg_quiz_1');
        expect(pkg.quizzes[0].items[0].questionId).toBe('pkg_q_1');
    });

    it('throws error when material is not found', async () => {
        const mockLibrary: LibraryRepository = {
            getMaterialById: vi.fn().mockResolvedValue(null),
            getMaterials: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const useCase = new MaterializeStudyPackageUseCase(
            mockLibrary,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await expect(useCase.execute({ materialId: 'nonexistent' })).rejects.toThrow(
            'Material with ID "nonexistent" not found.',
        );
    });
});
