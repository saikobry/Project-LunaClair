import { AbandonQuizSessionUseCase } from '../../../application/use-cases/quiz/AbandonQuizSessionUseCase';
import { StartQuizSessionUseCase } from '../../../application/use-cases/quiz/StartQuizSessionUseCase';
import { SubmitQuizSessionUseCase } from '../../../application/use-cases/quiz/SubmitQuizSessionUseCase';
import { CreateQuestionUseCase } from '../../../application/use-cases/quiz-management/CreateQuestionUseCase';
import { UpdateQuestionUseCase } from '../../../application/use-cases/quiz-management/UpdateQuestionUseCase';
import { ArchiveQuestionUseCase } from '../../../application/use-cases/quiz-management/ArchiveQuestionUseCase';
import { UnarchiveQuestionUseCase } from '../../../application/use-cases/quiz-management/UnarchiveQuestionUseCase';
import { PublishQuestionUseCase } from '../../../application/use-cases/quiz-management/PublishQuestionUseCase';
import { CreateQuizUseCase } from '../../../application/use-cases/quiz-management/CreateQuizUseCase';
import { UpdateQuizUseCase } from '../../../application/use-cases/quiz-management/UpdateQuizUseCase';
import { ArchiveQuizUseCase } from '../../../application/use-cases/quiz-management/ArchiveQuizUseCase';
import { UnarchiveQuizUseCase } from '../../../application/use-cases/quiz-management/UnarchiveQuizUseCase';
import { PublishQuizUseCase } from '../../../application/use-cases/quiz-management/PublishQuizUseCase';
import { SaveQuizUseCase } from '../../../application/use-cases/quiz-management/SaveQuizUseCase';
import { RecordFlashcardReviewUseCase } from '../../../application/use-cases/flashcards/RecordFlashcardReviewUseCase';
import { ResetFlashcardReviewsUseCase } from '../../../application/use-cases/flashcards/ResetFlashcardReviewsUseCase';
import type { Infrastructure } from '../createInfrastructure';
import {
    noopAnalyticsCacheInvalidator,
    withAnalyticsPoolInvalidationOnSave,
    type AnalyticsCacheInvalidator,
} from '../analyticsInvalidation';

export function createQuizUseCases(
    infrastructure: Infrastructure,
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
) {
    const { repositories, services } = infrastructure;

    return {
        flashcards: {
            recordReview: new RecordFlashcardReviewUseCase(repositories.flashcardReview),
            // Invoked *alongside* a question write, never from inside one: the
            // authoring use cases know nothing about review state.
            resetReviews: new ResetFlashcardReviewsUseCase(repositories.question, repositories.flashcardReview),
        },
        quiz: {
            startSession: new StartQuizSessionUseCase(repositories.quizSession),
            submitSession: new SubmitQuizSessionUseCase(repositories.quizSession),
            abandonSession: new AbandonQuizSessionUseCase(repositories.quizSession),
        },
        quizManagement: {
            createQuestion: new CreateQuestionUseCase(repositories.question),
            updateQuestion: new UpdateQuestionUseCase(repositories.question),
            archiveQuestion: new ArchiveQuestionUseCase(repositories.question),
            unarchiveQuestion: new UnarchiveQuestionUseCase(repositories.question),
            publishQuestion: new PublishQuestionUseCase(repositories.question),
            createQuiz: new CreateQuizUseCase(repositories.quiz),
            updateQuiz: new UpdateQuizUseCase(repositories.quiz),
            archiveQuiz: new ArchiveQuizUseCase(repositories.quiz),
            unarchiveQuiz: new UnarchiveQuizUseCase(repositories.quiz),
            publishQuiz: new PublishQuizUseCase(repositories.quiz),
            // The canvas commits questions through `QuizEditorService`, not
            // through `QuestionRepository`, so the repository-level analytics
            // invalidation never sees it. Decorated here for that reason alone.
            saveQuiz: withAnalyticsPoolInvalidationOnSave(
                new SaveQuizUseCase(repositories.question, services.quizEditor),
                invalidateAnalytics,
            ),
        },
    };
}
