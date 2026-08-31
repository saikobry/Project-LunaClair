import { AbandonQuizSessionUseCase } from '../../application/use-cases/quiz/AbandonQuizSessionUseCase';
import { StartQuizSessionUseCase } from '../../application/use-cases/quiz/StartQuizSessionUseCase';
import { SubmitQuizSessionUseCase } from '../../application/use-cases/quiz/SubmitQuizSessionUseCase';
import { CreateQuestionUseCase } from '../../application/use-cases/quiz-management/CreateQuestionUseCase';
import { UpdateQuestionUseCase } from '../../application/use-cases/quiz-management/UpdateQuestionUseCase';
import { ArchiveQuestionUseCase } from '../../application/use-cases/quiz-management/ArchiveQuestionUseCase';
import { UnarchiveQuestionUseCase } from '../../application/use-cases/quiz-management/UnarchiveQuestionUseCase';
import { PublishQuestionUseCase } from '../../application/use-cases/quiz-management/PublishQuestionUseCase';
import { CreateQuizUseCase } from '../../application/use-cases/quiz-management/CreateQuizUseCase';
import { UpdateQuizUseCase } from '../../application/use-cases/quiz-management/UpdateQuizUseCase';
import { ArchiveQuizUseCase } from '../../application/use-cases/quiz-management/ArchiveQuizUseCase';
import { UnarchiveQuizUseCase } from '../../application/use-cases/quiz-management/UnarchiveQuizUseCase';
import { PublishQuizUseCase } from '../../application/use-cases/quiz-management/PublishQuizUseCase';
import { SaveQuizUseCase } from '../../application/use-cases/quiz-management/SaveQuizUseCase';
import { CreateMaterialUseCase } from '../../application/use-cases/library/CreateMaterialUseCase';
import { UpdateMaterialUseCase } from '../../application/use-cases/library/UpdateMaterialUseCase';
import { DeleteMaterialUseCase } from '../../application/use-cases/library/DeleteMaterialUseCase';
import { ImportMaterialUseCase } from '../../application/use-cases/library/ImportMaterialUseCase';
import { ImportSubjectUseCase } from '../../application/use-cases/library/ImportSubjectUseCase';
import { RemoveImportedMaterialUseCase } from '../../application/use-cases/library/RemoveImportedMaterialUseCase';
import { SyncDefaultTermsUseCase } from '../../application/use-cases/library/SyncDefaultTermsUseCase';
import { TouchMaterialUseCase } from '../../application/use-cases/library/TouchMaterialUseCase';
import { CreateSubjectUseCase } from '../../application/use-cases/subject/CreateSubjectUseCase';
import { UpdateSubjectUseCase } from '../../application/use-cases/subject/UpdateSubjectUseCase';
import { ReorderSubjectsUseCase } from '../../application/use-cases/subject/ReorderSubjectsUseCase';
import { DeleteSubjectUseCase } from '../../application/use-cases/subject/DeleteSubjectUseCase';
import { CreateTermUseCase } from '../../application/use-cases/subject/CreateTermUseCase';
import { UpdateTermUseCase } from '../../application/use-cases/subject/UpdateTermUseCase';
import { CreateAndAssignTermUseCase } from '../../application/use-cases/subject/CreateAndAssignTermUseCase';
import { SyncSubjectTermsUseCase } from '../../application/use-cases/subject/SyncSubjectTermsUseCase';
import { ReorderSubjectTermsUseCase } from '../../application/use-cases/subject/ReorderSubjectTermsUseCase';
import { AddTermToSubjectUseCase } from '../../application/use-cases/subject/AddTermToSubjectUseCase';
import { RemoveTermFromSubjectUseCase } from '../../application/use-cases/subject/RemoveTermFromSubjectUseCase';
import { DeleteTermUseCase } from '../../application/use-cases/subject/DeleteTermUseCase';
import { SaveHighlightUseCase } from '../../application/use-cases/reader/SaveHighlightUseCase';
import { SaveDrawingUseCase } from '../../application/use-cases/reader/SaveDrawingUseCase';
import { ClearAnnotationsUseCase } from '../../application/use-cases/reader/ClearAnnotationsUseCase';
import { UpdateDocumentContentUseCase } from '../../application/use-cases/content/UpdateDocumentContentUseCase';
import { RecordFlashcardReviewUseCase } from '../../application/use-cases/flashcards/RecordFlashcardReviewUseCase';
import { GetGlobalAnalyticsUseCase } from '../../application/use-cases/analytics/GetGlobalAnalyticsUseCase';
import { GetSubjectAnalyticsUseCase } from '../../application/use-cases/analytics/GetSubjectAnalyticsUseCase';
import { GetMaterialAnalyticsUseCase } from '../../application/use-cases/analytics/GetMaterialAnalyticsUseCase';
import { SendChatMessageUseCase } from '../../application/use-cases/ai/SendChatMessageUseCase';
import { GetOrCreateAiThreadUseCase } from '../../application/use-cases/ai/GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../application/use-cases/ai/ClearChatHistoryUseCase';
import { GenerateQuestionsUseCase } from '../../application/use-cases/generator/GenerateQuestionsUseCase';
import { BatchCreateQuestionsUseCase } from '../../application/use-cases/generator/BatchCreateQuestionsUseCase';
import { GenerateFlashcardsUseCase } from '../../application/use-cases/generator/GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../../application/use-cases/generator/BatchCreateFlashcardsUseCase';
import { ExtractContentUseCase } from '../../application/use-cases/importer/ExtractContentUseCase';
import { CommitImportUseCase } from '../../application/use-cases/importer/CommitImportUseCase';
import { CleanupImportWithAiUseCase } from '../../application/use-cases/importer/CleanupImportWithAiUseCase';
import { MaterializeStudyPackageUseCase } from '../../application/use-cases/package/MaterializeStudyPackageUseCase';
import { ImportStudyPackageUseCase } from '../../application/use-cases/package/ImportStudyPackageUseCase';
import { PublishStudyPackageUseCase } from '../../application/use-cases/sharing/PublishStudyPackageUseCase';
import { FetchPublishedShareUseCase } from '../../application/use-cases/sharing/FetchPublishedShareUseCase';
import { TrackShareDownloadUseCase } from '../../application/use-cases/sharing/TrackShareDownloadUseCase';
import { DeletePublishedShareUseCase } from '../../application/use-cases/sharing/DeletePublishedShareUseCase';
import { ListPublicSharesUseCase } from '../../application/use-cases/sharing/ListPublicSharesUseCase';
import { ClonePublishedShareUseCase } from '../../application/use-cases/sharing/ClonePublishedShareUseCase';
import { SyncEngine } from '../../application/sync/SyncEngine';
import { syncStatusStore } from '../../application/sync/SyncStatusStore';
import { GetSyncStatusUseCase } from '../../application/use-cases/sync/GetSyncStatusUseCase';
import { GetConflictDraftsUseCase } from '../../application/use-cases/sync/GetConflictDraftsUseCase';
import { ResolveConflictDraftUseCase } from '../../application/use-cases/sync/ResolveConflictDraftUseCase';
import { TriggerSyncUseCase } from '../../application/use-cases/sync/TriggerSyncUseCase';
import type { Repositories } from './createRepositories';

export function createUseCases(repositories: Repositories) {
    const syncEngine = new SyncEngine(
        repositories.db,
        repositories.workerSyncTransport,
        repositories.dexieSyncReconciler,
        repositories.syncQueueRepository,
        repositories.syncStateRepository,
        syncStatusStore,
    );

    const getSyncStatusUseCase = new GetSyncStatusUseCase(
        syncStatusStore,
    );

    const getConflictDraftsUseCase = new GetConflictDraftsUseCase(
        repositories.conflictDraftRepository,
    );

    const resolveConflictDraftUseCase = new ResolveConflictDraftUseCase(
        repositories.db,
        repositories.conflictDraftRepository,
    );

    const triggerSyncUseCase = new TriggerSyncUseCase(
        syncEngine,
        repositories.credentialsProvider,
    );

    return {
        flashcards: {
            recordReview: new RecordFlashcardReviewUseCase(repositories.flashcardReviewRepository),
        },
        quiz: {
            startSession: new StartQuizSessionUseCase(repositories.quizSessionRepository),
            submitSession: new SubmitQuizSessionUseCase(repositories.quizSessionRepository),
            abandonSession: new AbandonQuizSessionUseCase(repositories.quizSessionRepository),
        },
        quizManagement: {
            createQuestion: new CreateQuestionUseCase(repositories.questionRepository),
            updateQuestion: new UpdateQuestionUseCase(repositories.questionRepository),
            archiveQuestion: new ArchiveQuestionUseCase(repositories.questionRepository),
            unarchiveQuestion: new UnarchiveQuestionUseCase(repositories.questionRepository),
            publishQuestion: new PublishQuestionUseCase(repositories.questionRepository),
            createQuiz: new CreateQuizUseCase(repositories.quizRepository),
            updateQuiz: new UpdateQuizUseCase(repositories.quizRepository),
            archiveQuiz: new ArchiveQuizUseCase(repositories.quizRepository),
            unarchiveQuiz: new UnarchiveQuizUseCase(repositories.quizRepository),
            publishQuiz: new PublishQuizUseCase(repositories.quizRepository),
            saveQuiz: new SaveQuizUseCase(repositories.questionRepository, repositories.quizEditorService),
        },
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            updateMaterial: new UpdateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            deleteMaterial: new DeleteMaterialUseCase(repositories.libraryRepository),
            touchMaterial: new TouchMaterialUseCase(repositories.libraryRepository),
            importMaterial: new ImportMaterialUseCase(repositories.catalogRepository, repositories.quizContentRepository, repositories.documentRepository, repositories.libraryImportService),
            importSubject: new ImportSubjectUseCase(repositories.catalogRepository, repositories.libraryRepository, repositories.quizContentRepository, repositories.documentRepository, repositories.libraryImportService),
            removeImportedMaterial: new RemoveImportedMaterialUseCase(repositories.libraryImportService),
            syncDefaultTerms: new SyncDefaultTermsUseCase(repositories.catalogRepository, repositories.termRepository),
        },
        subject: {
            createSubject: new CreateSubjectUseCase(repositories.subjectRepository),
            updateSubject: new UpdateSubjectUseCase(repositories.subjectRepository),
            reorderSubjects: new ReorderSubjectsUseCase(repositories.subjectRepository),
            deleteSubject: new DeleteSubjectUseCase(repositories.subjectRepository, repositories.libraryRepository),
            createTerm: new CreateTermUseCase(repositories.termRepository),
            updateTerm: new UpdateTermUseCase(repositories.termRepository),
            deleteTerm: new DeleteTermUseCase(repositories.termRepository),
            createAndAssignTerm: new CreateAndAssignTermUseCase(repositories.termService),
            syncTerms: new SyncSubjectTermsUseCase(repositories.subjectTermRepository, repositories.termRepository),
            reorderTerms: new ReorderSubjectTermsUseCase(repositories.subjectTermRepository),
            addTerm: new AddTermToSubjectUseCase(repositories.subjectTermRepository),
            removeTerm: new RemoveTermFromSubjectUseCase(repositories.subjectTermRepository),
        },
        reader: {
            saveHighlight: new SaveHighlightUseCase(repositories.annotationRepository),
            saveDrawing: new SaveDrawingUseCase(repositories.annotationRepository),
            clearAnnotations: new ClearAnnotationsUseCase(repositories.annotationRepository),
        },
        content: {
            updateDocumentContent: new UpdateDocumentContentUseCase(repositories.documentContentRepository),
        },
        analytics: {
            getGlobalAnalytics: new GetGlobalAnalyticsUseCase(repositories.analyticsRepository),
            getSubjectAnalytics: new GetSubjectAnalyticsUseCase(repositories.analyticsRepository),
            getMaterialAnalytics: new GetMaterialAnalyticsUseCase(repositories.analyticsRepository),
        },
        ai: {
            sendChatMessage: new SendChatMessageUseCase(repositories.aiService, repositories.aiChatRepository),
            getOrCreateThread: new GetOrCreateAiThreadUseCase(repositories.aiChatRepository),
            getThreadMessages: new GetAiThreadMessagesUseCase(repositories.aiChatRepository),
            deleteThread: new DeleteAiThreadUseCase(repositories.aiChatRepository),
            clearChatHistory: new ClearChatHistoryUseCase(repositories.aiChatRepository),
        },
        generator: {
            generateQuestions: new GenerateQuestionsUseCase(repositories.aiService),
            batchCreateQuestions: new BatchCreateQuestionsUseCase(repositories.questionRepository),
            generateFlashcards: new GenerateFlashcardsUseCase(repositories.aiService),
            batchCreateFlashcards: new BatchCreateFlashcardsUseCase(repositories.questionRepository),
        },
        importer: {
            extractContent: new ExtractContentUseCase(repositories.importerRegistry),
            commitImport: new CommitImportUseCase(
                repositories.libraryRepository,
                repositories.documentContentRepository,
                repositories.importAssetRepository,
            ),
            cleanupWithAi: new CleanupImportWithAiUseCase(repositories.aiService),
        },
        package: {
            materializeStudyPackage: new MaterializeStudyPackageUseCase(
                repositories.libraryRepository,
                repositories.documentContentRepository,
                repositories.questionRepository,
                repositories.quizRepository,
                repositories.importAssetRepository,
            ),
            importStudyPackage: new ImportStudyPackageUseCase(repositories.db),
        },
        sharing: {
            publishStudyPackage: new PublishStudyPackageUseCase(
                new MaterializeStudyPackageUseCase(
                    repositories.libraryRepository,
                    repositories.documentContentRepository,
                    repositories.questionRepository,
                    repositories.quizRepository,
                    repositories.importAssetRepository,
                ),
                repositories.shareTransport,
            ),
            fetchPublishedShare: new FetchPublishedShareUseCase(repositories.shareTransport),
            trackShareDownload: new TrackShareDownloadUseCase(repositories.shareTransport),
            deletePublishedShare: new DeletePublishedShareUseCase(repositories.shareTransport),
            listPublicShares: new ListPublicSharesUseCase(repositories.shareTransport),
            clonePublishedShare: new ClonePublishedShareUseCase(
                new FetchPublishedShareUseCase(repositories.shareTransport),
                new ImportStudyPackageUseCase(repositories.db),
                new TrackShareDownloadUseCase(repositories.shareTransport),
            ),
        },
        sync: {
            syncEngine,
            syncStatusStore,
            resolveConflictDraft: resolveConflictDraftUseCase,
            triggerSync: triggerSyncUseCase,
            getSyncStatus: getSyncStatusUseCase,
            getConflictDrafts: getConflictDraftsUseCase,
            resolveConflictDraftUseCase,
            triggerSyncUseCase,
            getSyncStatusUseCase,
            getConflictDraftsUseCase,
        },
        syncEngine,
        syncStatusStore,
        resolveConflictDraftUseCase,
        triggerSyncUseCase,
        getSyncStatusUseCase,
        getConflictDraftsUseCase,
    };
}

export type UseCases = ReturnType<typeof createUseCases>;
