import type { Question } from '../../../domain/quiz/models/Question';
import type { QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
export class PublishQuestionUseCase { private readonly questions: QuestionRepository; constructor(questions: QuestionRepository) { this.questions = questions; } execute(id: string): Promise<Question> { return this.questions.updateQuestion(id, { status: 'published' }); } }
