import type { DocumentRepository } from '../../domain/reader/repositories/DocumentRepository';
import type { DocumentContentRepository } from '../../domain/reader/repositories/DocumentContentRepository';
import type { AnnotationRepository } from '../../domain/reader/repositories/AnnotationRepository';
import type { LibraryRepository } from '../../domain/library/repositories/LibraryRepository';
import type { QuestionRepository } from '../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../domain/quiz/repositories/QuizRepository';
import type { QuizSessionRepository } from '../../domain/quiz/repositories/QuizSessionRepository';
import type { QuizDraftRepository } from '../../application/quiz-management/drafts/QuizDraftRepository';
import type { FlashcardReviewRepository } from '../../domain/flashcards/repositories/FlashcardReviewRepository';
import type { AnalyticsRepository } from '../../domain/analytics/repositories/AnalyticsRepository';
import type { AiChatRepository } from '../../domain/ai/repositories/AiChatRepository';
import type { ImportAssetRepository } from '../../domain/importer/repositories/ImportAssetRepository';
import type { SyncQueueRepository } from '../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../domain/sync/repositories/SyncStateRepository';
import type { ConflictDraftRepository } from '../../domain/sync/repositories/ConflictDraftRepository';
import type { CollectionRepository } from '../../domain/collections/repositories/CollectionRepository';
import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';

import { HybridDocumentRepository } from '../../infrastructure/storage/repositories/HybridDocumentRepository';
import { dexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { dexieDocumentContentRepository } from '../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { dexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { dexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { dexieQuizDraftRepository } from '../../infrastructure/database/repositories/DexieQuizDraftRepository';
import { dexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { dexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { dexieAnalyticsRepository } from '../../infrastructure/database/repositories/DexieAnalyticsRepository';
import { dexieFlashcardReviewRepository } from '../../infrastructure/database/repositories/DexieFlashcardReviewRepository';
import { dexieAiChatRepository } from '../../infrastructure/database/repositories/DexieAiChatRepository';
import { WorkerAiAdapter } from '../../infrastructure/ai/adapters/WorkerAiAdapter';
import { DexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { dexieImportAssetRepository } from '../../infrastructure/database/repositories/DexieImportAssetRepository';
import { DexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';
import { DexieStudyPackageImportService } from '../../infrastructure/database/services/DexieStudyPackageImportService';
import { createDefaultImporterRegistry } from '../../infrastructure/importer/registry/createExtractors';
import { dexieSyncQueueRepository } from '../../infrastructure/database/repositories/DexieSyncQueueRepository';
import { dexieSyncStateRepository } from '../../infrastructure/database/repositories/DexieSyncStateRepository';
import { dexieConflictDraftRepository } from '../../infrastructure/database/repositories/DexieConflictDraftRepository';
import { dexieCollectionRepository } from '../../infrastructure/database/repositories/DexieCollectionRepository';
import { dexieCollectionMaterialRepository } from '../../infrastructure/database/repositories/DexieCollectionMaterialRepository';
import { dexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';
import { workerSyncTransport } from '../../infrastructure/api/transports/WorkerSyncTransport';
import { workerShareTransport } from '../../infrastructure/api/transports/WorkerShareTransport';
import { localStorageCredentialsProvider } from '../../infrastructure/browser/storage/LocalStorageCredentialsProvider';
import { db, type LunaClairDatabase } from '../../infrastructure/database/schema/LunaClairDatabase';
import type { WorkerSyncTransport } from '../../infrastructure/api/transports/WorkerSyncTransport';
import type { WorkerShareTransport } from '../../infrastructure/api/transports/WorkerShareTransport';
import type { LocalStorageCredentialsProvider } from '../../infrastructure/browser/storage/LocalStorageCredentialsProvider';
import type { ImporterRegistry } from '../../domain/importer/services/ContentImporter';
import type { DexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';

/**
 * Public domain repositories contract exposed to the application layer.
 * Typed strictly with abstract Domain Ports, keeping features agnostic
 * of concrete IndexedDB or API adapters.
 */
export interface Repositories {
    document: DocumentRepository;
    documentContent: DocumentContentRepository;
    annotation: AnnotationRepository;
    library: LibraryRepository;
    question: QuestionRepository;
    quiz: QuizRepository;
    quizSession: QuizSessionRepository;
    quizDraft: QuizDraftRepository;
    flashcardReview: FlashcardReviewRepository;
    analytics: AnalyticsRepository;
    aiChat: AiChatRepository;
    importAsset: ImportAssetRepository;
    syncQueue: SyncQueueRepository;
    syncState: SyncStateRepository;
    conflictDraft: ConflictDraftRepository;
    collection: CollectionRepository;
    collectionMaterial: CollectionMaterialRepository;
}

/**
 * Internal infrastructure bundle encapsulating database, domain services,
 * network transports, and security providers.
 */
export interface Infrastructure {
    db: LunaClairDatabase;
    repositories: Repositories;
    services: {
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
    );

    const aiService = new WorkerAiAdapter();

    const repositories: Repositories = {
        document: documentRepository,
        documentContent: dexieDocumentContentRepository,
        annotation: dexieAnnotationRepository,
        library: dexieLibraryRepository,
        question: dexieQuestionRepository,
        quiz: dexieQuizRepository,
        quizSession: dexieQuizSessionRepository,
        quizDraft: dexieQuizDraftRepository,
        flashcardReview: dexieFlashcardReviewRepository,
        analytics: dexieAnalyticsRepository,
        aiChat: dexieAiChatRepository,
        importAsset: dexieImportAssetRepository,
        syncQueue: dexieSyncQueueRepository,
        syncState: dexieSyncStateRepository,
        conflictDraft: dexieConflictDraftRepository,
        collection: dexieCollectionRepository,
        collectionMaterial: dexieCollectionMaterialRepository,
    };

    return {
        db,
        repositories,
        services: {
            quizEditor: new DexieQuizEditorService(db),
            libraryImport: new DexieLibraryImportService(db),
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
