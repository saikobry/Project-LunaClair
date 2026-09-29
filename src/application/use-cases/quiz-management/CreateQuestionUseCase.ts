import type { Question } from '../../../domain/quiz/models/Question';
import type { CreateQuestionInput, QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
import { validateQuestionPayload } from '../../../domain/quiz/validation/questionPayloadValidation';

/**
 * Outcome of a Question Bank write — the same discriminated shape
 * `SaveQuizUseCase` returns, and for the same reason: a malformed answer payload is a
 * **refusal the author has to see and fix**, not a thrown error, because the editor holds the
 * content that would repair it.
 *
 * `errors` carries the findings of `validateQuestionPayload` verbatim, so each one names the
 * offending field (`… requires a non-empty "correctAnswer" string.`) and the editor can name it
 * without re-deriving or re-wording the rule.
 */
export type SaveQuestionResult =
    | { success: true; question: Question }
    | { success: false; errors: string[] };

/**
 * Creates a Question Bank question from the author editor.
 *
 * **This is a validating write boundary.** It calls `validateQuestionPayload` — the single owner
 * of "is this payload structurally valid for its declared type?" — rather than holding a third
 * copy of the rule. Until this call existed, the Bank was the one authoring surface with no
 * payload validator anywhere in its chain (editor → tab → `useQuestionManagement` → this), and
 * the editor's default payloads are malformed for four of the five types, reachable by typing a
 * prompt and nothing else. A blocked write is the only thing that stops such a row being born.
 */
export class CreateQuestionUseCase {
    private readonly questions: QuestionRepository;
    constructor(questions: QuestionRepository) { this.questions = questions; }
    async execute(input: CreateQuestionInput): Promise<SaveQuestionResult> {
        const errors = validateQuestionPayload(input.type, input.payload);
        if (errors.length > 0) return { success: false, errors };
        return { success: true, question: await this.questions.createQuestion({ ...input, status: 'draft' }) };
    }
}
