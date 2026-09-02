import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { QuizRepository } from '../../../domain/quiz/repositories/QuizRepository';
export class UnarchiveQuizUseCase { private readonly quizzes: QuizRepository; constructor(quizzes: QuizRepository) { this.quizzes = quizzes; } execute(id: string): Promise<Quiz> { return this.quizzes.updateQuiz(id, { status: 'draft' }); } }
