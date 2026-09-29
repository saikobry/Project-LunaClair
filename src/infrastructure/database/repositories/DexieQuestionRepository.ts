import type { Question } from '../../../domain/quiz/models/Question';
import type {
    QuestionRepository,
    CreateQuestionInput,
    UpdateQuestionInput,
} from '../../../domain/quiz/repositories/QuestionRepository';
import { cardKeyForQuestion } from '../../../domain/flashcards/engines/cardKey';
import { normalizeTags } from '../../../shared/utils/tags';
import { normalizeSourceSection } from '../../../shared/utils/sourceSection';
import { DexieFlashcardReviewRepository } from './DexieFlashcardReviewRepository';
import { db } from '../schema/LunaClairDatabase';

function generateId(): string {
    return `q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** The `#<index>` suffix every per-blank key of one question shares. */
function blankKeyPrefix(questionId: string): string {
    return `${cardKeyForQuestion(questionId)}#`;
}

export class DexieQuestionRepository implements QuestionRepository {
    /**
     * The single owner of review-state clearing for this repository, so a
     * question delete and the authoring use cases share one tombstone path.
     */
    private readonly flashcardReviews = new DexieFlashcardReviewRepository();

    async getQuestions(materialId: string, signal?: AbortSignal): Promise<Question[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.questions.where('materialId').equals(materialId).toArray();
    }

    async getQuestionById(id: string, signal?: AbortSignal): Promise<Question | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.questions.get(id)) ?? null;
    }

    async getQuestionsByIds(ids: string[], signal?: AbortSignal): Promise<Question[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (ids.length === 0) return [];
        return db.questions.where('id').anyOf(ids).toArray();
    }

    async createQuestion(input: CreateQuestionInput): Promise<Question> {
        const now = new Date().toISOString();
        const question: Question = {
            id: generateId(),
            materialId: input.materialId,
            type: input.type,
            prompt: input.prompt,
            payload: input.payload,
            difficulty: input.difficulty ?? 'medium',
            points: input.points ?? 1,
            explanation: input.explanation,
            tags: normalizeTags(input.tags),
            sourceSection: normalizeSourceSection(input.sourceSection),
            status: input.status ?? 'draft',
            version: 1,
            createdAt: now,
            updatedAt: now,
        };
        await db.questions.put(question);
        return question;
    }

    async createQuestionsBatch(inputs: CreateQuestionInput[]): Promise<Question[]> {
        if (inputs.length === 0) return [];
        const now = new Date().toISOString();
        const questions: Question[] = inputs.map((input) => ({
            id: generateId(),
            materialId: input.materialId,
            type: input.type,
            prompt: input.prompt,
            payload: input.payload,
            difficulty: input.difficulty ?? 'medium',
            points: input.points ?? 1,
            explanation: input.explanation,
            tags: normalizeTags(input.tags),
            sourceSection: normalizeSourceSection(input.sourceSection),
            status: input.status ?? 'draft',
            version: 1,
            createdAt: now,
            updatedAt: now,
        }));

        await db.transaction('rw', db.questions, async () => {
            await db.questions.bulkPut(questions);
        });

        return questions;
    }

    async updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question> {
        const existing = await db.questions.get(id);
        if (!existing) throw new Error(`Question not found: ${id}`);

        const updated: Question = {
            ...existing,
            ...input,
            tags: normalizeTags(input.tags ?? existing.tags),
            // `sourceSection` is a **three-state** field, and the three states are told apart on
            // the RAW input rather than on its normalized value, because "absent" and "present
            // but blank" both normalize to `undefined` and must not collapse into one:
            //
            //   absent   (`undefined`) — preserve the stored label. This is what a
            //                      publish/archive/difficulty-only save takes, so an unrelated
            //                      edit can never erase provenance it never carried.
            //   blank    (`''`/`'  '`) — CLEAR the label. A caller that means "this question has
            //                      no known origin" says so explicitly.
            //   labelled — replace it.
            //
            // Decided before the normalizer runs (rather than by the `??` inside it) so the
            // contract is the code's own statement and not an accident of ordering.
            sourceSection:
                input.sourceSection === undefined
                    ? existing.sourceSection
                    : normalizeSourceSection(input.sourceSection),
            version: existing.version + 1,
            updatedAt: new Date().toISOString(),
        };
        await db.questions.put(updated);
        return updated;
    }

    /**
     * Deletes the question **and every review row its cards owned.**
     *
     * A deleted question leaves nothing to project, so each of its keys —
     * the whole-question `q:<id>` for a 1:1 question, `q:<id>#<n>` for each
     * blank of a cloze one — is a card that no longer exists. Leaving those
     * rows behind would strand their SM-2 state forever: the analytics pool is
     * built from projected keys, so they would read as orphan diagnostics that
     * nothing can ever retire.
     *
     * The keys are read from storage by prefix rather than re-projected from
     * the question row, so keys left by an **earlier** shape are cleared too —
     * a question that was once a 3-blank cloze and is now 1:1 still has `#0..2`
     * rows, and re-projecting would only find `q:<id>`. The prefix is
     * `${cardKeyForQuestion(id)}#`, never the bare `q:<id>`, because a plain
     * `startsWith` on the bare key would also match a different question whose
     * id merely extends this one (`q:q-1` vs `q:q-12`).
     *
     * Clearing goes through `FlashcardReviewRepository.deleteByKeys`, which
     * writes a `DELETE` tombstone per key — a local-only clear is undone by the
     * next pull and the schedule resurrects. Its transaction scope
     * (`flashcardReviews`, `syncQueue`) is a subset of this one, so Dexie reuses
     * the running transaction: the row delete, the question delete, and the
     * outbox writes either all land or none do.
     */
    async deleteQuestion(id: string): Promise<void> {
        await db.transaction('rw', [db.questions, db.flashcardReviews, db.syncQueue], async () => {
            const blankKeys = await db.flashcardReviews
                .where('key')
                .startsWith(blankKeyPrefix(id))
                .primaryKeys();

            const keys: string[] = [...blankKeys];
            const wholeKey = cardKeyForQuestion(id);
            if (await db.flashcardReviews.get(wholeKey)) keys.push(wholeKey);

            await db.questions.delete(id);
            await this.flashcardReviews.deleteByKeys(keys);
        });
    }
}

export const dexieQuestionRepository = new DexieQuestionRepository();
