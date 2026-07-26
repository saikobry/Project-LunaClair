import type { QuestionRepository, CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import type { QuizRepository, CreateQuizInput, UpdateQuizInput } from '../../../domain/quiz/QuizRepository';
import type { Question } from '../../../domain/quiz/Question';
import type { Quiz, QuizQuestion } from '../../../domain/quiz/Quiz';

/**
 * Application service coordinating question validation, version increments,
 * soft-deletion archiving, quiz publishing, and repository commits.
 * Contains zero UI logic — purely orchestrates domain repositories.
 */
export class QuizManagementService {
    private readonly questionRepo: QuestionRepository;
    private readonly quizRepo: QuizRepository;

    constructor(questionRepo: QuestionRepository, quizRepo: QuizRepository) {
        this.questionRepo = questionRepo;
        this.quizRepo = quizRepo;
    }

    /** Creates a new question in draft status. */
    async createQuestion(input: CreateQuestionInput): Promise<Question> {
        return this.questionRepo.createQuestion({ ...input, status: 'draft' });
    }

    /** Updates a question, auto-incrementing its version via the repository. */
    async updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question> {
        return this.questionRepo.updateQuestion(id, input);
    }

    /** Publishes a question (draft → published). */
    async publishQuestion(id: string): Promise<Question> {
        return this.questionRepo.updateQuestion(id, { status: 'published' });
    }

    /** Soft-deletes a question by archiving it (does not break quiz references). */
    async archiveQuestion(id: string): Promise<Question> {
        return this.questionRepo.updateQuestion(id, { status: 'archived' });
    }

    /** Creates a quiz with version-pinned question references. */
    async createQuiz(input: CreateQuizInput, questions: Question[]): Promise<Quiz> {
        const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const items: QuizQuestion[] = input.questionIds.map((questionId, index) => {
            const question = questions.find((q) => q.id === questionId);
            return {
                quizId,
                questionId,
                questionVersion: question?.version ?? 1,
                order: index + 1,
                points: question?.points,
            };
        });

        return this.quizRepo.createQuiz({
            ...input,
            items,
            status: 'draft',
        });
    }

    /** Updates quiz metadata and/or question associations. */
    async updateQuiz(id: string, input: UpdateQuizInput): Promise<Quiz> {
        return this.quizRepo.updateQuiz(id, input);
    }

    /** Publishes a quiz (draft → published). */
    async publishQuiz(id: string): Promise<Quiz> {
        return this.quizRepo.updateQuiz(id, { status: 'published' });
    }

    /** Archives a quiz (soft-delete). */
    async archiveQuiz(id: string): Promise<Quiz> {
        return this.quizRepo.updateQuiz(id, { status: 'archived' });
    }
}
