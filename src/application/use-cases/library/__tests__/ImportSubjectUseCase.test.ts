import { describe, expect, it, vi } from 'vitest';
import { ImportSubjectUseCase } from '../ImportSubjectUseCase';
import type { CatalogRepository, CatalogSnapshot } from '../../../../domain/library/repositories/CatalogRepository';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { LibraryImportService } from '../../../../domain/library/services/LibraryImportService';
import type { QuizContentRepository } from '../../../../domain/quiz/repositories/QuizContentRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../../domain/library/models/Subject';
import type { Term } from '../../../../domain/library/models/Term';

describe('ImportSubjectUseCase', () => {
    const mockSubject: Subject = {
        id: 'sub-chem',
        title: 'General Chemistry',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockTerm: Term = {
        id: 'term-1',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const matA: StudyMaterial = {
        id: 'mat-a',
        title: 'Stoichiometry',
        subjectId: 'sub-chem',
        termId: 'term-1',
        documentId: 'doc-a',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const matB: StudyMaterial = {
        id: 'mat-b',
        title: 'Thermodynamics',
        subjectId: 'sub-chem',
        termId: 'term-1',
        documentId: 'doc-b',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const matC: StudyMaterial = {
        id: 'mat-c',
        title: 'Equilibrium',
        subjectId: 'sub-chem',
        termId: 'term-1',
        documentId: 'doc-c',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockCatalogSnapshot: CatalogSnapshot = {
        subjects: [mockSubject],
        terms: [mockTerm],
        subjectTerms: [{ subjectId: 'sub-chem', termId: 'term-1', order: 1 }],
        materials: [matA, matB, matC],
    };

    const createServices = (localMaterials: StudyMaterial[] = []) => {
        const catalog: CatalogRepository = {
            getCatalog: vi.fn().mockResolvedValue(mockCatalogSnapshot),
            getMaterial: vi.fn().mockImplementation((id: string) => {
                const mat = [matA, matB, matC].find((m) => m.id === id);
                if (!mat) throw new Error(`Material not found: ${id}`);
                return Promise.resolve({
                    material: mat,
                    subject: mockSubject,
                    term: mockTerm,
                    subjectTerm: { subjectId: 'sub-chem', termId: 'term-1', order: 1 },
                });
            }),
        };

        const library: LibraryRepository = {
            getMaterials: vi.fn().mockResolvedValue(localMaterials),
            getMaterialById: vi.fn(),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const quizContent: QuizContentRepository = {
            getQuizContent: vi.fn().mockResolvedValue({
                questions: [],
                quizzes: [],
            }),
        };

        const documentRepository: DocumentRepository = {
            getDocumentByMaterial: vi.fn().mockImplementation((material: StudyMaterial) =>
                Promise.resolve({
                    id: material.documentId,
                    title: material.title,
                    content: `# ${material.title}`,
                }),
            ),
        };

        const libraryImport: LibraryImportService = {
            importMaterial: vi.fn(),
            importMaterialBatch: vi.fn().mockResolvedValue(undefined),
            removeImportedMaterial: vi.fn(),
        };

        return { catalog, library, quizContent, documentRepository, libraryImport };
    };

    it('diffs against local library with getMaterials and batch imports unimported materials', async () => {
        // matA is already in local library, matB and matC are missing
        const { catalog, library, quizContent, documentRepository, libraryImport } = createServices([matA]);
        const useCase = new ImportSubjectUseCase(catalog, library, quizContent, documentRepository, libraryImport);

        const result = await useCase.execute('sub-chem');

        expect(library.getMaterials).toHaveBeenCalled();
        expect(libraryImport.importMaterialBatch).toHaveBeenCalledTimes(1);

        const batchArg = vi.mocked(libraryImport.importMaterialBatch).mock.calls[0][0];
        expect(batchArg).toHaveLength(2);
        expect(batchArg.map((item) => item.material.id)).toEqual(['mat-b', 'mat-c']);

        expect(result).toEqual({
            subjectId: 'sub-chem',
            subjectTitle: 'General Chemistry',
            totalMaterials: 3,
            importedCount: 2,
            alreadyImportedCount: 1,
            failedCount: 0,
        });
    });

    it('exits early without network or persistence calls when all materials are already imported', async () => {
        const { catalog, library, quizContent, libraryImport } = createServices([matA, matB, matC]);
        const useCase = new ImportSubjectUseCase(catalog, library, quizContent, {} as any, libraryImport);

        const result = await useCase.execute('sub-chem');

        expect(result).toEqual({
            subjectId: 'sub-chem',
            subjectTitle: 'General Chemistry',
            totalMaterials: 3,
            importedCount: 0,
            alreadyImportedCount: 3,
            failedCount: 0,
        });

        expect(quizContent.getQuizContent).not.toHaveBeenCalled();
        expect(libraryImport.importMaterialBatch).not.toHaveBeenCalled();
    });

    it('throws when subject is not in catalog', async () => {
        const { catalog, library, quizContent, documentRepository, libraryImport } = createServices();
        const useCase = new ImportSubjectUseCase(catalog, library, quizContent, documentRepository, libraryImport);

        await expect(useCase.execute('sub-nonexistent')).rejects.toThrow(
            'Subject with id "sub-nonexistent" not found in catalog',
        );
    });

    it('handles subject with zero materials', async () => {
        const emptySubjectSnapshot: CatalogSnapshot = {
            ...mockCatalogSnapshot,
            materials: [],
        };
        const { catalog, library, quizContent, documentRepository, libraryImport } = createServices();
        vi.mocked(catalog.getCatalog).mockResolvedValue(emptySubjectSnapshot);

        const useCase = new ImportSubjectUseCase(catalog, library, quizContent, documentRepository, libraryImport);
        const result = await useCase.execute('sub-chem');

        expect(result).toEqual({
            subjectId: 'sub-chem',
            subjectTitle: 'General Chemistry',
            totalMaterials: 0,
            importedCount: 0,
            alreadyImportedCount: 0,
            failedCount: 0,
        });
        expect(libraryImport.importMaterialBatch).not.toHaveBeenCalled();
    });

    it('commits successfully resolved materials when some individual materials fail to resolve', async () => {
        const { catalog, library, quizContent, documentRepository, libraryImport } = createServices([]);
        // Make matB fail authoritative resolution
        vi.mocked(catalog.getMaterial).mockImplementation((id: string) => {
            if (id === 'mat-b') {
                return Promise.reject(new Error('mat-b corrupted on server'));
            }
            const mat = [matA, matC].find((m) => m.id === id)!;
            return Promise.resolve({
                material: mat,
                subject: mockSubject,
                term: mockTerm,
                subjectTerm: { subjectId: 'sub-chem', termId: 'term-1', order: 1 },
            });
        });

        const useCase = new ImportSubjectUseCase(catalog, library, quizContent, documentRepository, libraryImport);
        const result = await useCase.execute('sub-chem');

        expect(libraryImport.importMaterialBatch).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ material: matA }),
                expect.objectContaining({ material: matC }),
            ]),
        );

        const batchArg = vi.mocked(libraryImport.importMaterialBatch).mock.calls[0][0];
        expect(batchArg).toHaveLength(2);

        expect(result).toEqual({
            subjectId: 'sub-chem',
            subjectTitle: 'General Chemistry',
            totalMaterials: 3,
            importedCount: 2,
            alreadyImportedCount: 0,
            failedCount: 1,
        });
    });
});
