import type { Question } from '../../../domain/quiz/models/Question';
import type { QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
import type { FlashcardReviewRepository } from '../../../domain/flashcards/repositories/FlashcardReviewRepository';
import { affectedClozeBlankIndices } from '../../../domain/flashcards/engines/clozeReviewReset';
import { cardKeyForBlank } from '../../../domain/flashcards/engines/cardKey';

export interface ResetFlashcardReviewsInput {
    /**
     * The pre-write questions, as returned by `capture`. Anything not in this
     * list is never touched, so a caller that forgets to bracket a write clears
     * nothing rather than clearing everything.
     */
    before: Question[];
}

export interface ResetFlashcardReviewsResult {
    /** Card keys whose review state was cleared. Empty when nothing was invalidated. */
    resetKeys: string[];
}

/**
 * Clears the SM-2 schedules a cloze edit invalidated.
 *
 * A `fill_in_blank` question projects one card per blank, each with its own
 * schedule under `q:${questionId}#${blankIndex}`. When the question behind a card
 * is edited, the blanks that now ask for a different answer no longer describe
 * the same fact, so their schedules must go — otherwise the learner keeps an
 * interval earned on the *previous* answer.
 *
 * **The decision is content-based, never version-based.** `version` increments on
 * every update, publish and archive included, so keying off it would wipe study
 * history every time a question was published. The pure predicate in
 * `domain/flashcards/engines/clozeReviewReset` owns that policy; this use case is
 * only orchestration: resolve the post-write rows, ask the predicate which blank
 * indices are affected, and delete exactly those keys.
 *
 * Deletion always goes through `FlashcardReviewRepository.deleteByKeys`, whose
 * adapter writes a sync tombstone in the same transaction as the row delete —
 * there is no tombstone-free path here.
 *
 * **Known limitation — the bracket is not durable, and a retry is not
 * self-healing.** If the question write succeeds and the review deletion then
 * fails, nothing records the pending invalidation. A retry re-captures the row
 * the write already replaced, so `before` and `after` are identical and the
 * invalidation is lost permanently. This is deliberate for now (the project is
 * pre-release and no history is at stake); making it recoverable needs a durable
 * pending-reset record, which is a real change to this use case and not a bug
 * fix. Pinned by `__tests__/ResetFlashcardReviewsUseCase.test.ts`.
 */
export class ResetFlashcardReviewsUseCase {
    private readonly questions: QuestionRepository;
    private readonly flashcardReviews: FlashcardReviewRepository;

    constructor(questions: QuestionRepository, flashcardReviews: FlashcardReviewRepository) {
        this.questions = questions;
        this.flashcardReviews = flashcardReviews;
    }

    /**
     * Phase 1 — read the questions **before** the write, keeping only the cloze
     * ones. A non-cloze question projects 1:1 to a whole-question card and has no
     * per-blank keys, so it can never have a schedule to reset.
     *
     * This has to happen before the write because `UpdateQuestionInput` is
     * partial: a caller that changes only `difficulty` supplies no payload at
     * all, so the post-write row is byte-identical to the pre-write one and
     * cannot by itself say whether cloze content moved. Capturing here also keeps
     * the read in the application layer — a feature may not read a repository
     * from inside a mutation.
     */
    async capture(questionIds: string[]): Promise<Question[]> {
        if (questionIds.length === 0) return [];
        const questions = await this.questions.getQuestionsByIds(questionIds);
        return questions.filter((question) => question.payload.type === 'fill_in_blank');
    }

    /**
     * Phase 2 — run **after** the write, comparing each captured question against
     * the row as it is now persisted. The post-write row is read rather than
     * merged from the write's input, so a partial update is a structural no-op:
     * the comparison sees an identical payload and invalidates nothing.
     */
    async execute(input: ResetFlashcardReviewsInput): Promise<ResetFlashcardReviewsResult> {
        if (input.before.length === 0) return { resetKeys: [] };

        const after = await this.questions.getQuestionsByIds(input.before.map((question) => question.id));
        const afterById = new Map(after.map((question) => [question.id, question]));

        const keys: string[] = [];
        for (const before of input.before) {
            const current = afterById.get(before.id);
            // The row is gone, so there is no after content to compare against
            // and nothing to invalidate here. Any key it left behind is an orphan
            // no card projects, which the pre-release no-migration decision in
            // `src/domain/AGENTS.md` already covers.
            if (!current) continue;
            for (const index of affectedClozeBlankIndices(before, current)) {
                keys.push(cardKeyForBlank(before.id, index));
            }
        }

        if (keys.length === 0) return { resetKeys: [] };
        await this.flashcardReviews.deleteByKeys(keys);
        return { resetKeys: keys };
    }
}
