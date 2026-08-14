import type { CatalogRepository } from '../../../domain/library/CatalogRepository';
import type { LibraryImportService } from '../../../domain/library/LibraryImportService';
import type { QuizContentRepository } from '../../../domain/quiz/QuizContentRepository';
import type { ImportedDocumentContent } from '../../../domain/reader/DocumentContentRepository';
import type { DocumentRepository } from '../../../domain/reader/DocumentRepository';
import type { Subject } from '../../../domain/library/Subject';
import type { Term } from '../../../domain/library/Term';
import type { SubjectTerm } from '../../../domain/library/SubjectTerm';

/**
 * Imports one material from the remote catalog into the local library.
 *
 * The user-facing action is "Add to Library": the material's metadata
 * (subject/term links), its document content, and its quiz content are
 * fetched from the API and persisted atomically into Dexie. Figures are NOT
 * copied into Dexie — they stay behind the service worker runtime cache
 * (locked decision), so only document markdown is persisted locally.
 *
 * Idempotent: re-importing an already-imported material overwrites the same
 * rows. Partial failure (e.g. quiz endpoint down) still imports the material
 * metadata + document so the library never blocks on a single endpoint.
 */
export class ImportMaterialUseCase {
    private readonly catalog: CatalogRepository;
    private readonly quizContent: QuizContentRepository;
    private readonly documentRepository: DocumentRepository;
    private readonly libraryImport: LibraryImportService;

    constructor(
        catalog: CatalogRepository,
        quizContent: QuizContentRepository,
        documentRepository: DocumentRepository,
        libraryImport: LibraryImportService,
    ) {
        this.catalog = catalog;
        this.quizContent = quizContent;
        this.documentRepository = documentRepository;
        this.libraryImport = libraryImport;
    }

    async execute(materialId: string, signal?: AbortSignal): Promise<void> {
        // 1. Resolve the material from the canonical catalog.
        const catalog = await this.catalog.getCatalog(signal);
        const material = catalog.materials.find((m) => m.id === materialId);
        if (!material) throw new Error(`Material not found in catalog: ${materialId}`);

        const subject: Subject | undefined = material.subjectId
            ? catalog.subjects.find((s) => s.id === material.subjectId)
            : undefined;
        const term: Term | undefined = material.termId
            ? catalog.terms.find((t) => t.id === material.termId)
            : undefined;
        const subjectTerm: SubjectTerm | undefined =
            material.subjectId && material.termId
                ? catalog.subjectTerms.find(
                      (st) => st.subjectId === material.subjectId && st.termId === material.termId,
                  )
                : undefined;

        // 2. Fetch document content (markdown) — figures stay SW-cached.
        let documentContent: ImportedDocumentContent | undefined;
        try {
            const doc = await this.documentRepository.getDocumentByMaterial(material, signal);
            documentContent = {
                sourceId: material.sourceId,
                title: doc.title,
                content: doc.content,
                updatedAt: material.updatedAt,
            };
        } catch {
            // Document content unavailable — import metadata/quiz only.
            // (partial failure: a material with no readable document still
            // lands in the library)
        }

        // 3. Fetch quiz content for this material (questions + quizzes).
        let questions: Awaited<ReturnType<QuizContentRepository['getQuizContent']>>['questions'] = [];
        let quizzes: Awaited<ReturnType<QuizContentRepository['getQuizContent']>>['quizzes'] = [];
        try {
            const quiz = await this.quizContent.getQuizContent(signal);
            questions = quiz.questions.filter((q) => q.materialId === material.id);
            quizzes = quiz.quizzes.filter((z) => z.materialId === material.id);
        } catch {
            // Quiz endpoint unavailable — material still imports without quiz content.
        }

        // 4. Persist atomically.
        await this.libraryImport.importMaterial({
            subject,
            term,
            subjectTerm,
            material,
            questions,
            quizzes,
            documentContent,
        });
    }
}
