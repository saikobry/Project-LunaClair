import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { CreateQuizInput, QuizRepository } from '../../../domain/quiz/repositories/QuizRepository';

export class CreateQuizUseCase {
    private readonly quizzes: QuizRepository;
    constructor(quizzes: QuizRepository) { this.quizzes = quizzes; }
    execute(input: CreateQuizInput, questions: Question[]): Promise<Quiz> {
        const items = input.questionIds.map((questionId, index) => {
            const question = questions.find((candidate) => candidate.id === questionId);
            return { quizId: '', questionId, questionVersion: question?.version ?? 1, order: index + 1, points: question?.points };
        });
        return this.quizzes.createQuiz({ ...input, items, status: 'draft' });
    }
}
