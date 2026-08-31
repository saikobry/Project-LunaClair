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
import { dexieAnalyticsRepository } from '../../infrastructure/database/repositories/DexieAnalyticsRepository';
import { dexieFlashcardReviewRepository } from '../../infrastructure/database/repositories/DexieFlashcardReviewRepository';
import { dexieAiChatRepository } from '../../infrastructure/database/repositories/DexieAiChatRepository';
import { WorkerAiAdapter } from '../../infrastructure/ai/WorkerAiAdapter';
import { dexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { dexieTermService } from '../../infrastructure/database/services/DexieTermService';
import { dexieImportAssetRepository } from '../../infrastructure/database/repositories/DexieImportAssetRepository';
import { dexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';
import { createDefaultImporterRegistry } from '../../infrastructure/importer/createExtractors';
import { dexieSyncQueueRepository } from '../../infrastructure/database/sync/DexieSyncQueueRepository';
import { dexieSyncStateRepository } from '../../infrastructure/database/sync/DexieSyncStateRepository';
import { dexieConflictDraftRepository } from '../../infrastructure/database/sync/DexieConflictDraftRepository';
import { dexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';
import { workerSyncTransport } from '../../infrastructure/sync/WorkerSyncTransport';
import { workerShareTransport } from '../../infrastructure/sharing/WorkerShareTransport';
import { localStorageCredentialsProvider } from '../../infrastructure/sync/LocalStorageCredentialsProvider';
import { db } from '../../infrastructure/database/LunaClairDatabase';

/**
 * Creates and structures the application's infrastructure layer.
 * Groups concrete database repositories, domain services, network transports,
 * and security providers into explicit, typed namespaces.
 */
export function createInfrastructure() {
    const documentRepository = new HybridDocumentRepository(
        dexieDocumentContentRepository,
        apiDocumentRepository,
    );

    const aiService = new WorkerAiAdapter();

    return {
        db,
        repositories: {
            document: documentRepository,
            catalog: apiCatalogRepository,
            quizContent: apiQuizContentRepository,
            documentContent: dexieDocumentContentRepository,
            annotation: dexieAnnotationRepository,
            library: dexieLibraryRepository,
            question: dexieQuestionRepository,
            quiz: dexieQuizRepository,
            quizSession: dexieQuizSessionRepository,
            subject: dexieSubjectRepository,
            term: dexieTermRepository,
            subjectTerm: dexieSubjectTermRepository,
            quizDraft: dexieQuizDraftRepository,
            flashcardReview: dexieFlashcardReviewRepository,
            analytics: dexieAnalyticsRepository,
            aiChat: dexieAiChatRepository,
            importAsset: dexieImportAssetRepository,
            syncQueue: dexieSyncQueueRepository,
            syncState: dexieSyncStateRepository,
            conflictDraft: dexieConflictDraftRepository,
        },
        services: {
            term: dexieTermService,
            quizEditor: dexieQuizEditorService,
            libraryImport: dexieLibraryImportService,
            ai: aiService,
        },
        transports: {
            sync: workerSyncTransport,
            share: workerShareTransport,
        },
        providers: {
            credentials: localStorageCredentialsProvider,
        },
        importerRegistry: createDefaultImporterRegistry(),
        syncReconciler: dexieSyncReconciler,
    };
}

export type Infrastructure = ReturnType<typeof createInfrastructure>;
