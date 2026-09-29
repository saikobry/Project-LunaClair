import { describe, expect, it, vi } from 'vitest';
import { MaterializeStudyPackageUseCase } from '../MaterializeStudyPackageUseCase';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentContentRepository } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { QuestionRepository } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../../../domain/quiz/repositories/QuizRepository';
import type { AssetRepository, StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

describe('MaterializeStudyPackageUseCase', () => {
    const mockMaterial: StudyMaterial = {
        id: 'mat-local-1',
        title: 'Cell Biology Notes',
        description: 'Comprehensive study guide',
        documentId: 'doc-local-1',
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

        const mockAssets: AssetRepository = {
            get: vi.fn().mockResolvedValue(undefined),
            getByMaterialId: vi.fn().mockResolvedValue([]),
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

    function storedAsset(assetId: string, filename: string): StoredAsset {
        return {
            assetId,
            materialId: 'mat-local-1',
            blob: new Blob([`bytes:${assetId}`], { type: 'image/png' }),
            mimeType: 'image/png',
            filename,
            importedAt: '2026-09-01T00:00:00.000Z',
        };
    }

    function createUseCase(options: { content?: string; assets?: StoredAsset[] } = {}) {
        const mockLibrary: LibraryRepository = {
            getMaterialById: vi.fn().mockResolvedValue(mockMaterial),
            getMaterials: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
        };

        const mockDocContent: DocumentContentRepository = {
            getByDocumentId: vi.fn().mockResolvedValue({
                documentId: 'doc-local-1',
                title: 'Cell Biology Notes',
                content: options.content ?? '# Chapter 1\nCells are life.',
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

        const mockAssets: AssetRepository = {
            get: vi.fn().mockResolvedValue(undefined),
            getByMaterialId: vi.fn().mockResolvedValue(options.assets ?? []),
        };

        return new MaterializeStudyPackageUseCase(
            mockLibrary,
            mockDocContent,
            mockQuestions,
            mockQuizzes,
            mockAssets,
        );
    }

    it('materializes every stored asset as pkg_asset_N in deterministic order', async () => {
        const useCase = createUseCase({
            assets: [
                storedAsset('asset-z', 'figure-b.png'),
                storedAsset('asset-m', 'figure-a.png'),
                storedAsset('asset-a', 'figure-a.png'),
            ],
        });

        const pkg = await useCase.execute({ materialId: 'mat-local-1' });

        // filename asc, then asset id as the tie-breaker for the two identical filenames.
        expect(pkg.assets?.map((asset) => [asset.id, asset.filename])).toEqual([
            ['pkg_asset_1', 'figure-a.png'],
            ['pkg_asset_2', 'figure-a.png'],
            ['pkg_asset_3', 'figure-b.png'],
        ]);
    });

    it('pairs each document reference with its own asset payload', async () => {
        const useCase = createUseCase({
            content: '# Figures\n\n![A](lc-asset://asset-z)\n\n![B](lc-asset://asset-a)',
            assets: [storedAsset('asset-a', 'a.png'), storedAsset('asset-z', 'z.png')],
        });

        const pkg = await useCase.execute({ materialId: 'mat-local-1' });
        const content = pkg.materials[0].documentContent;

        // asset-a sorts first (a.png) → pkg_asset_1; asset-z (z.png) → pkg_asset_2.
        expect(pkg.assets?.map((asset) => [asset.id, asset.filename])).toEqual([
            ['pkg_asset_1', 'a.png'],
            ['pkg_asset_2', 'z.png'],
        ]);
        expect(content).toContain('![A](lc-asset://pkg_asset_2)');
        expect(content).toContain('![B](lc-asset://pkg_asset_1)');

        // The payload under each package id is that asset's own bytes. The blobs here are created
        // in-process (no fake-indexeddb round trip), so this is a real byte comparison — the
        // assertion that catches "right URI, wrong payload".
        expect(pkg.assets?.find((a) => a.id === 'pkg_asset_1')?.dataBase64).toBe(btoa('bytes:asset-a'));
        expect(pkg.assets?.find((a) => a.id === 'pkg_asset_2')?.dataBase64).toBe(btoa('bytes:asset-z'));
    });

    it('leaves references with no matching asset untouched', async () => {
        const useCase = createUseCase({
            content: '![Missing](lc-asset://not-a-stored-asset)',
            assets: [storedAsset('asset-a', 'a.png')],
        });

        const pkg = await useCase.execute({ materialId: 'mat-local-1' });

        expect(pkg.materials[0].documentContent).toContain('lc-asset://not-a-stored-asset');
    });

    it('rewires a legacy reference whose asset id equals its material id', async () => {
        const useCase = createUseCase({
            content: '![Legacy](lc-asset://mat-local-1)',
            // A v13 row migrated by v14: identity is the material id.
            assets: [storedAsset('mat-local-1', 'legacy.pdf')],
        });

        const pkg = await useCase.execute({ materialId: 'mat-local-1' });

        expect(pkg.materials[0].documentContent).toContain('lc-asset://pkg_asset_1');
    });

    it('omits the assets array when the material stores none', async () => {
        const useCase = createUseCase({ assets: [] });

        const pkg = await useCase.execute({ materialId: 'mat-local-1' });

        expect(pkg.assets).toBeUndefined();
        expect(pkg.materials[0].documentContent).toBe('# Chapter 1\nCells are life.');
    });

    describe('question sourceSection (optional provenance)', () => {
        /** A use case whose single question carries (or lacks) a section label. */
        function useCaseWithSourceSection(sourceSection?: string) {
            const question: Question = { ...mockQuestion, sourceSection };
            return new MaterializeStudyPackageUseCase(
                {
                    getMaterialById: vi.fn().mockResolvedValue(mockMaterial),
                    getMaterials: vi.fn(),
                    createMaterial: vi.fn(),
                    updateMaterial: vi.fn(),
                },
                {
                    getByDocumentId: vi.fn().mockResolvedValue({
                        documentId: 'doc-local-1',
                        title: 'Cell Biology Notes',
                        content: '# Chapter 1',
                        updatedAt: '2026-09-01T00:00:00.000Z',
                    }),
                    put: vi.fn(),
                    deleteByDocumentId: vi.fn(),
                },
                {
                    getQuestions: vi.fn().mockResolvedValue([question]),
                    getQuestionById: vi.fn(),
                    getQuestionsByIds: vi.fn(),
                    createQuestion: vi.fn(),
                    createQuestionsBatch: vi.fn(),
                    updateQuestion: vi.fn(),
                    deleteQuestion: vi.fn(),
                },
                {
                    getQuizzes: vi.fn().mockResolvedValue([]),
                    getQuizById: vi.fn(),
                    getQuizzesForMaterials: vi.fn(),
                    getQuizzesByIds: vi.fn(),
                    createQuiz: vi.fn(),
                    updateQuiz: vi.fn(),
                    deleteQuiz: vi.fn(),
                },
                { get: vi.fn(), getByMaterialId: vi.fn().mockResolvedValue([]) },
            );
        }

        it('exports a question\'s section label so the provenance survives publish', async () => {
            const pkg = await useCaseWithSourceSection('Cell Organelles').execute({ materialId: 'mat-local-1' });

            expect(pkg.questions[0].sourceSection).toBe('Cell Organelles');
        });

        it('omits the key when the question has no label, never synthesizing one', async () => {
            const pkg = await useCaseWithSourceSection(undefined).execute({ materialId: 'mat-local-1' });

            // Absent is a valid package, and an export must not invent provenance.
            expect(pkg.questions[0].sourceSection).toBeUndefined();
        });
    });
});
