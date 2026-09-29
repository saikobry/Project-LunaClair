import type { QuestionRepository, UpdateQuestionInput } from '../../../domain/quiz/repositories/QuestionRepository';
import { validateQuestionPayload } from '../../../domain/quiz/validation/questionPayloadValidation';
import type { SaveQuestionResult } from './CreateQuestionUseCase';

/**
 * Updates a Question Bank question from the author editor.
 *
 * **This is a validating write boundary**, the counterpart to `CreateQuestionUseCase`: it calls
 * the same single owner, `validateQuestionPayload`, instead of a second copy of the rule.
 *
 * Two facts shape the gate:
 *
 * - **A partial input carrying no `payload` is NOT gated.** `UpdateQuestionInput` is partial by
 *   contract (a publish, archive, or points-only save supplies no payload), and the Bank editor
 *   always supplies the full payload it holds. Gating an absent payload would refuse a metadata
 *   edit over content this call is not writing — so the rule is applied to a payload *this write
 *   actually supplies*, which is also exactly the repair path: a row that predates the gate is
 *   refused on the save that leaves it broken and accepted on the save that fixes it.
 * - **The declared type is the STORED one, not the payload's own `type`.** `UpdateQuestionInput`
 *   carries no `type`; the row's is the fact the payload is judged against, which is what makes
 *   the `payload.type` ↔ question-type agreement rule enforceable here at all.
 */
export class UpdateQuestionUseCase {
    private readonly questions: QuestionRepository;
    constructor(questions: QuestionRepository) { this.questions = questions; }

    async execute(id: string, input: UpdateQuestionInput): Promise<SaveQuestionResult> {
        if (input.payload !== undefined) {
            // A missing row is left to `updateQuestion`, which owns that refusal and its message.
            const existing = await this.questions.getQuestionById(id);
            if (existing) {
                const errors = validateQuestionPayload(existing.type, input.payload);
                if (errors.length > 0) return { success: false, errors };
            }
        }
        return { success: true, question: await this.questions.updateQuestion(id, input) };
    }
}
