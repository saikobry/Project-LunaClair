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
import type { AiModelCatalogRepository } from '../../domain/ai/repositories/AiModelCatalogRepository';
import type { ImportAssetRepository } from '../../domain/importer/repositories/ImportAssetRepository';
import type { AssetRepository } from '../../domain/assets/repositories/AssetRepository';
import type { SyncQueueRepository } from '../../domain/sync/repositories/SyncQueueRepository';
import type { SyncStateRepository } from '../../domain/sync/repositories/SyncStateRepository';
import type { ConflictDraftRepository } from '../../domain/sync/repositories/ConflictDraftRepository';
import type { CollectionRepository } from '../../domain/collections/repositories/CollectionRepository';
import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';
import type { PreferencesRepository } from '../../domain/preferences/repositories/PreferencesRepository';

import { HybridDocumentRepository } from '../../infrastructure/storage/repositories/HybridDocumentRepository';
import { DexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { DexieDocumentContentRepository } from '../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { DexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { DexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { DexieQuizDraftRepository } from '../../infrastructure/database/repositories/DexieQuizDraftRepository';
import { DexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { DexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { DexieAnalyticsRepository } from '../../infrastructure/database/repositories/DexieAnalyticsRepository';
import { DexieFlashcardReviewRepository } from '../../infrastructure/database/repositories/DexieFlashcardReviewRepository';
import { DexieAiChatRepository } from '../../infrastructure/database/repositories/DexieAiChatRepository';
import { DexiePreferencesRepository } from '../../infrastructure/database/repositories/DexiePreferencesRepository';
import { WorkerAiAdapter } from '../../infrastructure/ai/adapters/WorkerAiAdapter';
import { WorkerAiModelCatalogRepository } from '../../infrastructure/ai/catalog/WorkerAiModelCatalogRepository';
import { DexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { DexieImportAssetRepository } from '../../infrastructure/database/repositories/DexieImportAssetRepository';
import { DexieAssetRepository } from '../../infrastructure/database/repositories/DexieAssetRepository';
import { DexieLibraryImportService } from '../../infrastructure/database/services/DexieLibraryImportService';
import { DexieStudyPackageImportService } from '../../infrastructure/database/services/DexieStudyPackageImportService';
import { createDefaultImporterRegistry } from '../../infrastructure/importer/registry/createExtractors';
import { AiVisionExtractor } from '../../infrastructure/importer/engines/AiVisionExtractor';
import { DexieSyncQueueRepository } from '../../infrastructure/database/repositories/DexieSyncQueueRepository';
import { DexieSyncStateRepository } from '../../infrastructure/database/repositories/DexieSyncStateRepository';
import { DexieConflictDraftRepository } from '../../infrastructure/database/repositories/DexieConflictDraftRepository';
import { DexieCollectionRepository } from '../../infrastructure/database/repositories/DexieCollectionRepository';
import { DexieCollectionMaterialRepository } from '../../infrastructure/database/repositories/DexieCollectionMaterialRepository';
import { DexieSyncReconciler } from '../../infrastructure/database/sync/DexieSyncReconciler';
import { googleDriveSyncTransport } from '../../infrastructure/api/transports/GoogleDriveSyncTransport';
import { googleAuthService } from '../../infrastructure/auth/google/GoogleAuthService';
import { workerShareTransport } from '../../infrastructure/api/transports/WorkerShareTransport';
import { localStorageCredentialsProvider } from '../../infrastructure/browser/storage/LocalStorageCredentialsProvider';
import type { SyncTransport } from '../../domain/sync/services/SyncTransport';
import type { GoogleAuthPort } from '../../domain/auth/models/auth.types';
import {
    getActiveVaultDatabase,
    openVaultDatabase,
    setActiveVaultDatabase,
    type LunaClairDatabase,
} from '../../infrastructure/database/schema/LunaClairDatabase';
import { vaultRegistry } from '../../infrastructure/database/registry/VaultRegistry';
import type { VaultRegistryPort } from '../../domain/vault/models/vault.types';
import type { WorkerShareTransport } from '../../infrastructure/api/transports/WorkerShareTransport';
import type { LocalStorageCredentialsProvider } from '../../infrastructure/browser/storage/LocalStorageCredentialsProvider';
import type { AiService } from '../../domain/ai/services/AiService';
import type { ImporterRegistry } from '../../domain/importer/services/ContentImporter';
import {
    noopAnalyticsCacheInvalidator,
    withAnalyticsPoolInvalidation,
    type AnalyticsCacheInvalidator,
} from './analyticsInvalidation';

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
    aiModelCatalog: AiModelCatalogRepository;
    preferences: PreferencesRepository;
    importAsset: ImportAssetRepository;
    asset: AssetRepository;
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
        /** Typed as the domain port: features/use cases must not depend on the concrete gateway. */
        ai: AiService;
    };
    transports: {
        sync: SyncTransport;
        share: WorkerShareTransport;
    };
    providers: {
        credentials: LocalStorageCredentialsProvider;
        auth: GoogleAuthPort;
    };
    importerRegistry: ImporterRegistry;
    syncReconciler: DexieSyncReconciler;
}

/**
 * Creates and structures the application's infrastructure layer.
 *
 * `invalidateAnalytics` is supplied by the app shell and is why the question
 * repository is registered as a *decorator* rather than the bare adapter: every
 * question write changes the projected analytics card pool, and the composition
 * root is the one layer that may coordinate that without giving
 * `features/quiz-management` a dependency on `features/analytics`. See
 * `analyticsInvalidation.ts`.
 *
 * Repositories, atomic services, and reconcilers are instantiated with `database`,
 * which defaults to the active vault database.
 */
export function createInfrastructure(
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
    database: LunaClairDatabase = getActiveVaultDatabase(),
): Infrastructure {
    const documentContentRepository = new DexieDocumentContentRepository(database);
    const documentRepository = new HybridDocumentRepository(documentContentRepository);
    const annotationRepository = new DexieAnnotationRepository(database);
    const libraryRepository = new DexieLibraryRepository(database);
    const questionRepository = new DexieQuestionRepository(database);
    const quizRepository = new DexieQuizRepository(database);
    const quizSessionRepository = new DexieQuizSessionRepository(database);
    const quizDraftRepository = new DexieQuizDraftRepository(database);
    const flashcardReviewRepository = new DexieFlashcardReviewRepository(database);
    const analyticsRepository = new DexieAnalyticsRepository(database);
    const aiChatRepository = new DexieAiChatRepository(database);
    const preferencesRepository = new DexiePreferencesRepository(database);
    const importAssetRepository = new DexieImportAssetRepository(database);
    const assetRepository = new DexieAssetRepository(database);
    const syncQueueRepository = new DexieSyncQueueRepository(database);
    const syncStateRepository = new DexieSyncStateRepository(database);
    const conflictDraftRepository = new DexieConflictDraftRepository(database);
    const collectionRepository = new DexieCollectionRepository(database);
    const collectionMaterialRepository = new DexieCollectionMaterialRepository(database);

    const aiService = new WorkerAiAdapter();
    const aiVisionExtractor = new AiVisionExtractor(aiService);
    const aiModelCatalogRepository = new WorkerAiModelCatalogRepository();

    const repositories: Repositories = {
        document: documentRepository,
        documentContent: documentContentRepository,
        annotation: annotationRepository,
        library: libraryRepository,
        question: withAnalyticsPoolInvalidation(questionRepository, invalidateAnalytics),
        quiz: quizRepository,
        quizSession: quizSessionRepository,
        quizDraft: quizDraftRepository,
        flashcardReview: flashcardReviewRepository,
        analytics: analyticsRepository,
        aiChat: aiChatRepository,
        aiModelCatalog: aiModelCatalogRepository,
        preferences: preferencesRepository,
        importAsset: importAssetRepository,
        asset: assetRepository,
        syncQueue: syncQueueRepository,
        syncState: syncStateRepository,
        conflictDraft: conflictDraftRepository,
        collection: collectionRepository,
        collectionMaterial: collectionMaterialRepository,
    };

    const standbySyncTransport: SyncTransport = {
        async push() {
            return { accepted: [], conflicts: [], rejected: [] };
        },
        async pull(_credentials, cursor) {
            return { newCursor: cursor, hasMore: false, changes: [] };
        },
    };

    const dynamicSyncTransport: SyncTransport = {
        async push(credentials, request, signal) {
            const transport = googleAuthService.getSession()
                ? googleDriveSyncTransport
                : standbySyncTransport;
            return transport.push(credentials, request, signal);
        },
        async pull(credentials, cursor, limit, signal) {
            const transport = googleAuthService.getSession()
                ? googleDriveSyncTransport
                : standbySyncTransport;
            return transport.pull(credentials, cursor, limit, signal);
        },
    };

    return {
        db: database,
        repositories,
        services: {
            quizEditor: new DexieQuizEditorService(database),
            libraryImport: new DexieLibraryImportService(database),
            studyPackageImport: new DexieStudyPackageImportService(database),
            ai: aiService,
        },
        transports: {
            sync: dynamicSyncTransport,
            share: workerShareTransport,
        },
        providers: {
            credentials: localStorageCredentialsProvider,
            auth: googleAuthService,
        },
        importerRegistry: createDefaultImporterRegistry(aiVisionExtractor),
        syncReconciler: new DexieSyncReconciler(database),
    };
}

/**
 * Asynchronously resolves the active vault pointer from `VaultRegistry`, sets it as the active
 * vault database, and instantiates the application infrastructure.
 */
export async function createInfrastructureAsync(
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
    preferredSub?: string,
    registry: VaultRegistryPort = vaultRegistry,
): Promise<Infrastructure> {
    const activeVault = await registry.getActiveVault(preferredSub);
    const database = openVaultDatabase(activeVault.physicalDbName);
    setActiveVaultDatabase(database);
    return createInfrastructure(invalidateAnalytics, database);
}
