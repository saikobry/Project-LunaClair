import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { QuizRepository, UpdateQuizInput } from '../../../domain/quiz/repositories/QuizRepository';
export class UpdateQuizUseCase { private readonly quizzes: QuizRepository; constructor(quizzes: QuizRepository) { this.quizzes = quizzes; } execute(id: string, input: UpdateQuizInput): Promise<Quiz> { return this.quizzes.updateQuiz(id, input); } }
