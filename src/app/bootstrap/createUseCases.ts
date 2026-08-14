import { AddTermToSubjectUseCase, ArchiveQuestionUseCase, ArchiveQuizUseCase, ClearAnnotationsUseCase, CreateAndAssignTermUseCase, CreateMaterialUseCase, CreateQuestionUseCase, CreateQuizUseCase, DeleteMaterialUseCase, DeleteSubjectUseCase, DeleteTermUseCase, ImportMaterialUseCase, PublishQuestionUseCase, PublishQuizUseCase, RemoveImportedMaterialUseCase, RemoveTermFromSubjectUseCase, ReorderSubjectTermsUseCase, SaveDrawingUseCase, SaveHighlightUseCase, SaveQuizUseCase, StartQuizSessionUseCase, SubmitQuizSessionUseCase, SyncDefaultTermsUseCase, SyncSubjectTermsUseCase, TouchMaterialUseCase, UnarchiveQuestionUseCase, UnarchiveQuizUseCase, UpdateMaterialUseCase, UpdateQuestionUseCase, UpdateQuizUseCase } from '../../application';
import type { Repositories } from './createRepositories';

export function createUseCases(repositories: Repositories) {
    return {
        quiz: { startSession: new StartQuizSessionUseCase(repositories.quizSessionRepository), submitSession: new SubmitQuizSessionUseCase(repositories.quizSessionRepository) },
        quizManagement: {
            createQuestion: new CreateQuestionUseCase(repositories.questionRepository), updateQuestion: new UpdateQuestionUseCase(repositories.questionRepository), archiveQuestion: new ArchiveQuestionUseCase(repositories.questionRepository), unarchiveQuestion: new UnarchiveQuestionUseCase(repositories.questionRepository), publishQuestion: new PublishQuestionUseCase(repositories.questionRepository),
            createQuiz: new CreateQuizUseCase(repositories.quizRepository), updateQuiz: new UpdateQuizUseCase(repositories.quizRepository), archiveQuiz: new ArchiveQuizUseCase(repositories.quizRepository), unarchiveQuiz: new UnarchiveQuizUseCase(repositories.quizRepository), publishQuiz: new PublishQuizUseCase(repositories.quizRepository),
            saveQuiz: new SaveQuizUseCase(repositories.questionRepository, repositories.quizEditorService),
        },
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            updateMaterial: new UpdateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            deleteMaterial: new DeleteMaterialUseCase(repositories.libraryRepository),
            touchMaterial: new TouchMaterialUseCase(repositories.libraryRepository),
            importMaterial: new ImportMaterialUseCase(repositories.catalogRepository, repositories.quizContentRepository, repositories.documentRepository, repositories.libraryImportService),
            removeImportedMaterial: new RemoveImportedMaterialUseCase(repositories.libraryImportService),
            syncDefaultTerms: new SyncDefaultTermsUseCase(repositories.catalogRepository, repositories.termRepository),
        },
        subject: { createAndAssignTerm: new CreateAndAssignTermUseCase(repositories.termService), syncTerms: new SyncSubjectTermsUseCase(repositories.subjectTermRepository, repositories.termRepository), reorderTerms: new ReorderSubjectTermsUseCase(repositories.subjectTermRepository), addTerm: new AddTermToSubjectUseCase(repositories.subjectTermRepository), removeTerm: new RemoveTermFromSubjectUseCase(repositories.subjectTermRepository), deleteSubject: new DeleteSubjectUseCase(repositories.subjectRepository, repositories.libraryRepository), deleteTerm: new DeleteTermUseCase(repositories.termRepository) },
        reader: { saveHighlight: new SaveHighlightUseCase(repositories.annotationRepository), saveDrawing: new SaveDrawingUseCase(repositories.annotationRepository), clearAnnotations: new ClearAnnotationsUseCase(repositories.annotationRepository) },
    };
}

export type UseCases = ReturnType<typeof createUseCases>;
