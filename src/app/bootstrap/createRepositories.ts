import { apiCatalogRepository } from '../../services/content/ApiCatalogRepository';
import { apiDocumentRepository } from '../../services/content/ApiDocumentRepository';
import { apiQuizContentRepository } from '../../services/content/ApiQuizContentRepository';
import { HybridDocumentRepository } from '../../services/content/HybridDocumentRepository';
import { dexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { dexieDocumentContentRepository } from '../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { dexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { dexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { dexieQuizDraftRepository } from '../../infrastructure/database/repositories/DexieQuizDraftRepository';
import { dexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { dexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { dexieSubjectRepository } from '../../infrastructure/database/repositories/DexieSubjectRepository';
import { dexieSubjectTermRepository } from '../../infrastructure/database/repositories/DexieSubjectTermRepository';
import { dexieTermRepository } from '../../infrastructure/database/repositories/DexieTermRepository';
import { dexieFlashcardReviewRepository } from '../../infrastructure/database/repositories/DexieFlashcardReviewRepository';
import { dexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { dexieTermService } from '../../infrastructure/database/services/DexieTermService';
import { dexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';

export function createRepositories() {
    // Reader resolves imported content from Dexie first, API second.
    const documentRepository = new HybridDocumentRepository(
        dexieDocumentContentRepository,
        apiDocumentRepository,
    );

    return {
        documentRepository,
        catalogRepository: apiCatalogRepository,
        quizContentRepository: apiQuizContentRepository,
        documentContentRepository: dexieDocumentContentRepository,
        libraryImportService: dexieLibraryImportService,
        annotationRepository: dexieAnnotationRepository,
        libraryRepository: dexieLibraryRepository,
        questionRepository: dexieQuestionRepository,
        quizRepository: dexieQuizRepository,
        quizSessionRepository: dexieQuizSessionRepository,
        subjectRepository: dexieSubjectRepository,
        termRepository: dexieTermRepository,
        subjectTermRepository: dexieSubjectTermRepository,
        termService: dexieTermService,
        quizDraftRepository: dexieQuizDraftRepository,
        quizEditorService: dexieQuizEditorService,
        flashcardReviewRepository: dexieFlashcardReviewRepository,
    };
}

export type Repositories = ReturnType<typeof createRepositories>;
