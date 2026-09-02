import type { DocumentRepository } from '../../domain/reader/repositories/DocumentRepository';
import type { CatalogRepository } from '../../domain/library/repositories/CatalogRepository';
import type { QuizContentRepository } from '../../domain/quiz/repositories/QuizContentRepository';
import type { DocumentContentRepository } from '../../domain/reader/repositories/DocumentContentRepository';
import type { AnnotationRepository } from '../../domain/reader/repositories/AnnotationRepository';
import type { LibraryRepository } from '../../domain/library/repositories/LibraryRepository';
import type { QuestionRepository } from '../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../domain/quiz/repositories/QuizRepository';
import type { QuizSessionRepository } from '../../domain/quiz/repositories/QuizSessionRepository';
import type { SubjectRepository } from '../../domain/library/repositories/SubjectRepository';
import type { TermRepository } from '../../domain/library/repositories/TermRepository';
import type { SubjectTermRepository } from '../../domain/library/repositories/SubjectTermRepository';
import type { QuizDraftRepository } from '../../application/quiz-management/drafts/QuizDraftRepository';
import type { FlashcardReviewRepository } from '../../domain/flashcards/repositories/FlashcardReviewRepository';
import type { AnalyticsRepository } from '../../domain/analytics/repositories/AnalyticsRepository';
import type { AiChatRepository } from '../../domain/ai/repositories/AiChatRepository';
import type { ImportAssetRepository } from '../../domain/importer/repositories/ImportAssetRepository';
import type { SyncQueueRepository } from '../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../domain/sync/repositories/SyncStateRepository';
import type { ConflictDraftRepository } from '../../domain/sync/repositories/ConflictDraftRepository';

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
import { DexieStudyPackageImportService } from '../../infrastructure/database/services/DexieStudyPackageImportService';
import { createDefaultImporterRegistry } from '../../infrastructure/importer/createExtractors';
import { dexieSyncQueueRepository } from '../../infrastructure/database/sync/DexieSyncQueueRepository';
import { dexieSyncStateRepository } from '../../infrastructure/database/sync/DexieSyncStateRepository';
import { dexieConflictDraftRepository } from '../../infrastructure/database/sync/DexieConflictDraftRepository';
import { dexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';
import { workerSyncTransport } from '../../infrastructure/sync/WorkerSyncTransport';
import { workerShareTransport } from '../../infrastructure/sharing/WorkerShareTransport';
import { localStorageCredentialsProvider } from '../../infrastructure/sync/LocalStorageCredentialsProvider';
import { db, type LunaClairDatabase } from '../../infrastructure/database/LunaClairDatabase';
import type { DexieTermService } from '../../infrastructure/database/services/DexieTermService';
import type { DexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import type { DexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';
import type { WorkerSyncTransport } from '../../infrastructure/sync/WorkerSyncTransport';
import type { WorkerShareTransport } from '../../infrastructure/sharing/WorkerShareTransport';
import type { LocalStorageCredentialsProvider } from '../../infrastructure/sync/LocalStorageCredentialsProvider';
import type { ImporterRegistry } from '../../domain/importer/services/ContentImporter';
import type { DexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';

/**
 * Public domain repositories contract exposed to the application layer.
 * Typed strictly with abstract Domain Ports, keeping features agnostic
 * of concrete IndexedDB or API adapters.
 */
export interface Repositories {
    document: DocumentRepository;
    catalog: CatalogRepository;
    quizContent: QuizContentRepository;
    documentContent: DocumentContentRepository;
    annotation: AnnotationRepository;
    library: LibraryRepository;
    question: QuestionRepository;
    quiz: QuizRepository;
    quizSession: QuizSessionRepository;
    subject: SubjectRepository;
    term: TermRepository;
    subjectTerm: SubjectTermRepository;
    quizDraft: QuizDraftRepository;
    flashcardReview: FlashcardReviewRepository;
    analytics: AnalyticsRepository;
    aiChat: AiChatRepository;
    importAsset: ImportAssetRepository;
    syncQueue: SyncQueueRepository;
    syncState: SyncStateRepository;
    conflictDraft: ConflictDraftRepository;
}

/**
 * Internal infrastructure bundle encapsulating database, domain services,
 * network transports, and security providers.
 */
export interface Infrastructure {
    db: LunaClairDatabase;
    repositories: Repositories;
    services: {
        term: DexieTermService;
        quizEditor: DexieQuizEditorService;
        libraryImport: DexieLibraryImportService;
        studyPackageImport: DexieStudyPackageImportService;
        ai: WorkerAiAdapter;
    };
    transports: {
        sync: WorkerSyncTransport;
        share: WorkerShareTransport;
    };
    providers: {
        credentials: LocalStorageCredentialsProvider;
    };
    importerRegistry: ImporterRegistry;
    syncReconciler: DexieSyncReconciler;
}

/**
 * Creates and structures the application's infrastructure layer.
 */
export function createInfrastructure(): Infrastructure {
    const documentRepository = new HybridDocumentRepository(
        dexieDocumentContentRepository,
        apiDocumentRepository,
    );

    const aiService = new WorkerAiAdapter();

    const repositories: Repositories = {
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
    };

    return {
        db,
        repositories,
        services: {
            term: dexieTermService,
            quizEditor: dexieQuizEditorService,
            libraryImport: dexieLibraryImportService,
            studyPackageImport: new DexieStudyPackageImportService(db),
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
