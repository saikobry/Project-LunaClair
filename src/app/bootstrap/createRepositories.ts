import { apiCatalogRepository } from '../../infrastructure/api/ApiCatalogRepository';
import { apiDocumentRepository } from '../../infrastructure/api/ApiDocumentRepository';
import { apiQuizContentRepository } from '../../infrastructure/api/ApiQuizContentRepository';
import { HybridDocumentRepository } from '../../infrastructure/api/HybridDocumentRepository';
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
import { dexieAnalyticsRepository } from '../../infrastructure/database/repositories/DexieAnalyticsRepository';
import { WorkerAiAdapter } from '../../infrastructure/ai/WorkerAiAdapter';
import { dexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { dexieTermService } from '../../infrastructure/database/services/DexieTermService';
import { dexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';

export function createRepositories() {
    // Reader resolves imported content from Dexie first, API second.
    const documentRepository = new HybridDocumentRepository(
        dexieDocumentContentRepository,
        apiDocumentRepository,
    );

    const aiService = new WorkerAiAdapter();

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
        analyticsRepository: dexieAnalyticsRepository,
        aiService,
    };
}

export type Repositories = ReturnType<typeof createRepositories>;
