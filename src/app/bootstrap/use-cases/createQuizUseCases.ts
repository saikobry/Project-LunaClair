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
import type { Repositories } from '../createRepositories';

export function createQuizUseCases(repositories: Repositories) {
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
    };
}
