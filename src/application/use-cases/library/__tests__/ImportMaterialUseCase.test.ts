import { describe, expect, it, vi } from 'vitest';
import { ImportMaterialUseCase } from '../ImportMaterialUseCase';
import type { CatalogRepository } from '../../../../domain/library/repositories/CatalogRepository';
import type { LibraryImportService, ImportMaterialInput } from '../../../../domain/library/services/LibraryImportService';
import type { QuizContentRepository } from '../../../../domain/quiz/repositories/QuizContentRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../../domain/library/models/Subject';
import type { Term } from '../../../../domain/library/models/Term';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

describe('ImportMaterialUseCase', () => {
    const mockMaterial: StudyMaterial = {
        id: 'mat-101',
        title: 'Cell Biology Notes',
        subjectId: 'sub-bio',
        termId: 'term-prelim',
        documentId: 'doc-101',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockSubject: Subject = {
        id: 'sub-bio',
        title: 'General Biology',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockTerm: Term = {
        id: 'term-prelim',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockQuestion: Question = {
        id: 'q-bio-1',
        materialId: 'mat-101',
        type: 'multiple_choice',
        prompt: 'What is ATP?',
        payload: { type: 'multiple_choice', choices: ['Energy', 'Protein'], correctIndex: 0 },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockQuiz: Quiz = {
        id: 'quiz-bio-1',
        materialId: 'mat-101',
        title: 'Bio Quiz',
        status: 'published',
        questionIds: ['q-bio-1'],
        items: [{ quizId: 'quiz-bio-1', questionId: 'q-bio-1', questionVersion: 1, order: 1 }],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createServices = () => {
        const catalog: CatalogRepository = {
            getCatalog: vi.fn(),
            getMaterial: vi.fn().mockResolvedValue({
                material: mockMaterial,
                subject: mockSubject,
                term: mockTerm,
                subjectTerm: { subjectId: 'sub-bio', termId: 'term-prelim', order: 1 },
            }),
        };

        const quizContent: QuizContentRepository = {
            getQuizContent: vi.fn().mockResolvedValue({
                questions: [
                    mockQuestion,
                    { ...mockQuestion, id: 'q-other', materialId: 'mat-other' },
                ],
                quizzes: [
                    mockQuiz,
                    { ...mockQuiz, id: 'quiz-other', materialId: 'mat-other' },
                ],
            }),
        };

        const documentRepository: DocumentRepository = {
            getDocumentByMaterial: vi.fn().mockResolvedValue({
                id: 'doc-101',
                title: 'Cell Biology Notes',
                content: '# Biology Chapter 1\nCells are the basic unit of life.',
            }),
        };

        const libraryImport: LibraryImportService = {
            importMaterial: vi.fn().mockResolvedValue(undefined),
            importMaterialBatch: vi.fn(),
            removeImportedMaterial: vi.fn(),
        };

        return { catalog, quizContent, documentRepository, libraryImport };
    };

    it('resolves material authoritatively and persists metadata, markdown, and quizzes atomically', async () => {
        const { catalog, quizContent, documentRepository, libraryImport } = createServices();
        const useCase = new ImportMaterialUseCase(catalog, quizContent, documentRepository, libraryImport);

        await useCase.execute('mat-101');

        expect(catalog.getMaterial).toHaveBeenCalledWith('mat-101', undefined);
        expect(documentRepository.getDocumentByMaterial).toHaveBeenCalledWith(mockMaterial, undefined);
        expect(quizContent.getQuizContent).toHaveBeenCalledWith(undefined);

        const expectedPayload: ImportMaterialInput = {
            subject: mockSubject,
            term: mockTerm,
            subjectTerm: { subjectId: 'sub-bio', termId: 'term-prelim', order: 1 },
            material: mockMaterial,
            questions: [mockQuestion],
            quizzes: [mockQuiz],
            documentContent: {
                documentId: 'doc-101',
                title: 'Cell Biology Notes',
                content: '# Biology Chapter 1\nCells are the basic unit of life.',
                updatedAt: mockMaterial.updatedAt,
            },
        };

        expect(libraryImport.importMaterial).toHaveBeenCalledWith(expectedPayload);
    });

    it('propagates error when material is not found in canonical catalog', async () => {
        const { catalog, quizContent, documentRepository, libraryImport } = createServices();
        vi.mocked(catalog.getMaterial).mockRejectedValue(new Error('Material not found: mat-unknown'));

        const useCase = new ImportMaterialUseCase(catalog, quizContent, documentRepository, libraryImport);

        await expect(useCase.execute('mat-unknown')).rejects.toThrow('Material not found: mat-unknown');
        expect(libraryImport.importMaterial).not.toHaveBeenCalled();
    });

    it('tolerates document fetch failure by importing metadata and quizzes with undefined documentContent', async () => {
        const { catalog, quizContent, documentRepository, libraryImport } = createServices();
        vi.mocked(documentRepository.getDocumentByMaterial).mockRejectedValue(new Error('Document 404'));

        const useCase = new ImportMaterialUseCase(catalog, quizContent, documentRepository, libraryImport);

        await useCase.execute('mat-101');

        expect(libraryImport.importMaterial).toHaveBeenCalledWith(
            expect.objectContaining({
                material: mockMaterial,
                documentContent: undefined,
                questions: [mockQuestion],
                quizzes: [mockQuiz],
            }),
        );
    });

    it('tolerates quiz endpoint failure by importing metadata and document with empty quiz arrays', async () => {
        const { catalog, quizContent, documentRepository, libraryImport } = createServices();
        vi.mocked(quizContent.getQuizContent).mockRejectedValue(new Error('Quiz API 500'));

        const useCase = new ImportMaterialUseCase(catalog, quizContent, documentRepository, libraryImport);

        await useCase.execute('mat-101');

        expect(libraryImport.importMaterial).toHaveBeenCalledWith(
            expect.objectContaining({
                material: mockMaterial,
                questions: [],
                quizzes: [],
                documentContent: expect.objectContaining({
                    documentId: 'doc-101',
                }),
            }),
        );
    });

    it('passes AbortSignal through to repositories', async () => {
        const { catalog, quizContent, documentRepository, libraryImport } = createServices();
        const useCase = new ImportMaterialUseCase(catalog, quizContent, documentRepository, libraryImport);

        const controller = new AbortController();
        await useCase.execute('mat-101', controller.signal);

        expect(catalog.getMaterial).toHaveBeenCalledWith('mat-101', controller.signal);
        expect(documentRepository.getDocumentByMaterial).toHaveBeenCalledWith(mockMaterial, controller.signal);
        expect(quizContent.getQuizContent).toHaveBeenCalledWith(controller.signal);
    });
});
