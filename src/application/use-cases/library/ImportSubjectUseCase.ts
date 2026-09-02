import type { CatalogRepository } from '../../../domain/library/repositories/CatalogRepository';
import type { LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
import type { LibraryImportService, ImportMaterialInput } from '../../../domain/library/services/LibraryImportService';
import type { QuizContentRepository } from '../../../domain/quiz/repositories/QuizContentRepository';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { DocumentRepository } from '../../../domain/reader/repositories/DocumentRepository';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';

export interface ImportSubjectResult {
    subjectId: string;
    subjectTitle: string;
    totalMaterials: number;
    importedCount: number;
    alreadyImportedCount: number;
    failedCount: number;
}

/**
 * Imports an entire subject and its unimported study materials from the remote
 * catalog into the local library in a single atomic batch transaction.
 *
 * Workflow:
 * 1. Reads the remote catalog snapshot to find the subject and its materials.
 * 2. Compares against the local library to identify missing materials (pure idempotency).
 *    If all materials are already in the library, exits early without network or DB writes.
 * 3. Fetches quiz content once for the whole subject batch.
 * 4. Resolves each missing material as a complete import unit in parallel (metadata + document + quizzes).
 * 5. Persists all successfully resolved materials atomically via `LibraryImportService.importMaterialBatch`.
 */
export class ImportSubjectUseCase {
    private readonly catalog: CatalogRepository;
    private readonly library: LibraryRepository;
    private readonly quizContent: QuizContentRepository;
    private readonly documentRepository: DocumentRepository;
    private readonly libraryImport: LibraryImportService;

    constructor(
        catalog: CatalogRepository,
        library: LibraryRepository,
        quizContent: QuizContentRepository,
        documentRepository: DocumentRepository,
        libraryImport: LibraryImportService,
    ) {
        this.catalog = catalog;
        this.library = library;
        this.quizContent = quizContent;
        this.documentRepository = documentRepository;
        this.libraryImport = libraryImport;
    }

    async execute(subjectId: string, signal?: AbortSignal): Promise<ImportSubjectResult> {
        // 1. Resolve subject and its catalog materials
        const catalogSnapshot = await this.catalog.getCatalog(signal);
        const subject = catalogSnapshot.subjects.find((s) => s.id === subjectId);
        if (!subject) {
            throw new Error(`Subject with id "${subjectId}" not found in catalog`);
        }

        const subjectMaterials = catalogSnapshot.materials.filter((m) => m.subjectId === subjectId);
        const totalMaterials = subjectMaterials.length;

        if (totalMaterials === 0) {
            return {
                subjectId,
                subjectTitle: subject.title,
                totalMaterials: 0,
                importedCount: 0,
                alreadyImportedCount: 0,
                failedCount: 0,
            };
        }

        // 2. Inspect local library to determine unimported materials
        const localMaterials = await this.library.getMaterials(signal);
        const localIds = new Set(localMaterials.map((m) => m.id));
        const missingMaterials = subjectMaterials.filter((m) => !localIds.has(m.id));
        const alreadyImportedCount = totalMaterials - missingMaterials.length;

        // Idempotency: if all materials are already present, no-op
        if (missingMaterials.length === 0) {
            return {
                subjectId,
                subjectTitle: subject.title,
                totalMaterials,
                importedCount: 0,
                alreadyImportedCount,
                failedCount: 0,
            };
        }

        // 3. Fetch remote quiz content once for the batch
        let allRemoteQuestions: Question[] = [];
        let allRemoteQuizzes: Quiz[] = [];
        try {
            const quizPayload = await this.quizContent.getQuizContent(signal);
            allRemoteQuestions = quizPayload.questions;
            allRemoteQuizzes = quizPayload.quizzes;
        } catch {
            // Quiz endpoint failure: materials still import without quizzes
        }

        // 4. Resolve each missing material as a complete import unit
        let failedCount = 0;
        const resolvePromises = missingMaterials.map(async (mat): Promise<ImportMaterialInput | null> => {
            try {
                // Authoritative per-material resolution
                const resolution = await this.catalog.getMaterial(mat.id, signal);

                // Fetch markdown document
                let documentContent: ImportedDocumentContent | undefined;
                try {
                    const doc = await this.documentRepository.getDocumentByMaterial(resolution.material, signal);
                    documentContent = {
                        documentId: resolution.material.documentId,
                        title: doc.title,
                        content: doc.content,
                        updatedAt: resolution.material.updatedAt,
                    };
                } catch {
                    // Document fetch failure
                }

                const questions = allRemoteQuestions.filter((q) => q.materialId === mat.id);
                const quizzes = allRemoteQuizzes.filter((z) => z.materialId === mat.id);

                return {
                    subject: resolution.subject ?? subject,
                    term: resolution.term,
                    subjectTerm: resolution.subjectTerm,
                    material: resolution.material,
                    questions,
                    quizzes,
                    documentContent,
                };
            } catch {
                return null;
            }
        });

        const settled = await Promise.all(resolvePromises);
        const importInputs: ImportMaterialInput[] = [];

        for (const item of settled) {
            if (item) {
                importInputs.push(item);
            } else {
                failedCount++;
            }
        }

        // 5. Commit all successfully resolved materials in ONE atomic Dexie transaction
        if (importInputs.length > 0) {
            await this.libraryImport.importMaterialBatch(importInputs);
        }

        return {
            subjectId,
            subjectTitle: subject.title,
            totalMaterials,
            importedCount: importInputs.length,
            alreadyImportedCount,
            failedCount,
        };
    }
}
