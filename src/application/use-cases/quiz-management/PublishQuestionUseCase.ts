import type { Question } from '../../../domain/quiz/Question';
import type { QuestionRepository } from '../../../domain/quiz/QuestionRepository';
export class PublishQuestionUseCase { private readonly questions: QuestionRepository; constructor(questions: QuestionRepository) { this.questions = questions; } execute(id: string): Promise<Question> { return this.questions.updateQuestion(id, { status: 'published' }); } }
