import type { Question } from '../../../domain/quiz/models/Question';
import type { CreateQuestionInput, QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';

export class CreateQuestionUseCase {
    private readonly questions: QuestionRepository;
    constructor(questions: QuestionRepository) { this.questions = questions; }
    execute(input: CreateQuestionInput): Promise<Question> {
        return this.questions.createQuestion({ ...input, status: 'draft' });
    }
}
