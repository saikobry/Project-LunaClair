import type { Quiz } from '../../../domain/quiz/Quiz';
import type { QuizRepository } from '../../../domain/quiz/QuizRepository';
export class ArchiveQuizUseCase { private readonly quizzes: QuizRepository; constructor(quizzes: QuizRepository) { this.quizzes = quizzes; } execute(id: string): Promise<Quiz> { return this.quizzes.updateQuiz(id, { status: 'archived' }); } }
