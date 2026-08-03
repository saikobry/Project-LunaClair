import type { Question } from '../../../domain/quiz/Question';
import type { QuestionRepository, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';

export class UpdateQuestionUseCase {
    private readonly questions: QuestionRepository;
    constructor(questions: QuestionRepository) { this.questions = questions; }
    execute(id: string, input: UpdateQuestionInput): Promise<Question> {
        return this.questions.updateQuestion(id, input);
    }
}
