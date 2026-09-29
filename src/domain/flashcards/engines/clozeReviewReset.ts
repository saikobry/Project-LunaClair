import type { Question } from '../../quiz/models/Question';
import type { FillBlankPayload } from '../../quiz/models/AnswerPayload';
import { resolveClozeCardFront } from './clozeCardFront';

/**
 * The single owner of the cloze schedule-invalidation policy: which of a
 * `fill_in_blank` question's per-blank review keys stop describing the same
 * facts once the question is edited.
 *
 * Per-blank cards key review state as `q:${questionId}#${blankIndex}`, so a key
 * is invalidated when the blank at that index stops asking for the same answer,
 * or when the front it is rendered from changes.
 *
 * **The comparison is on the RESOLVED card front, not on `template` and not on
 * `prompt` separately.** Invalidation follows the content the learner is
 * actually tested on, and that is the resolved front — so the predicate reads
 * it through `resolveClozeCardFront`, the same function `questionToCards`
 * renders from, and the two can never disagree about what a card says. A
 * reworded *generic* prompt ("Fill in the blank:" → "Fill in the gap:")
 * resolves to the same front and therefore invalidates nothing, while a real,
 * non-generic prompt is part of the front, so editing it invalidates. The
 * resolved front also subsumes a direct `template` comparison: a template edit
 * changes the front wherever the template is rendered at all, and where the
 * prompt holds the markers the template is not rendered, so there is nothing
 * for a schedule to have been earned on. There is no second template check here.
 *
 * The rule is **asymmetric about cloze-ness**, because the keys are asymmetric:
 * retiring a `fill_in_blank` question's type leaves its per-blank keys behind
 * with no card projecting them (permanent orphans), whereas a question that
 * only just became cloze has brand-new keys that can carry no history yet. The
 * question's single `q:${questionId}` key belongs to a card shape that no
 * longer exists and is a separate concern.
 *
 * **This is content-based, deliberately NOT version-based.** `version` increments
 * on *every* update — publish, archive, a difficulty tweak — so keying off it
 * would wipe a question's study history each time it was published. Everything
 * the front and the blanks do not render is ignored too: `status`, `points`,
 * `tags`, `explanation`, `difficulty`, `materialId`, quiz membership and
 * `order`.
 *
 * Comparison basis is trimmed + case-folded, matching `FillBlankStrategy`'s
 * `v.trim().toLowerCase() === blank.trim().toLowerCase()`: the grader already
 * treats `"Mitochondria"` and `"mitochondria "` as the same answer, so a purely
 * cosmetic edit must not invalidate a schedule the grader considers identical.
 * If the grader and this ever disagree, a cosmetic edit would reset a schedule
 * for a question whose answer did not change.
 */
function normalize(text: string): string {
    return text.trim().toLowerCase();
}

function clozePayloadOf(question: Question): FillBlankPayload | null {
    return question.payload.type === 'fill_in_blank' ? question.payload : null;
}

function blankIndices(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index);
}

/**
 * Every blank index a reset must clear: the union of the before and after
 * lengths, so a shrink also clears the keys the removed blanks left behind.
 */
function allBlankIndices(before: string[], after: string[]): number[] {
    return blankIndices(Math.max(before.length, after.length));
}

/**
 * The blank indices whose schedules no longer describe the same fact.
 *
 * Returns an empty array for a question that was not a cloze question before
 * the edit (it projects 1:1 to a whole-question card, so it has no per-blank
 * keys to reset) and for a cloze question whose resolved front and blanks are
 * unchanged after normalization.
 */
export function affectedClozeBlankIndices(before: Question, after: Question): number[] {
    const beforePayload = clozePayloadOf(before);

    // Nothing existed to retire: a non-cloze question has no per-blank keys, and
    // a question that only just became cloze has brand-new keys with no history
    // to invalidate.
    if (!beforePayload) return [];
    const beforeBlanks = beforePayload.blanks;

    // A cloze question converted to any other type now projects 1:1 to a single
    // whole-question card, so no card projects its old per-blank keys any more.
    // Retiring all of them is the asymmetric half of the rule: left in place
    // they would sit in `flashcardReviews` forever with nothing rendering them.
    const afterPayload = clozePayloadOf(after);
    if (!afterPayload) return blankIndices(beforeBlanks.length);
    const afterBlanks = afterPayload.blanks;

    // The resolved front is the text every card front is rendered from, so
    // editing it invalidates every blank — including blanks whose own answer
    // survived. `resolveClozeCardFront` is the same function the projection
    // renders from, so the two cannot drift, which is the whole reason the
    // resolver is shared.
    const beforeFront = resolveClozeCardFront(before.prompt, beforePayload.template);
    const afterFront = resolveClozeCardFront(after.prompt, afterPayload.template);
    if (normalize(beforeFront) !== normalize(afterFront)) {
        return allBlankIndices(beforeBlanks, afterBlanks);
    }

    // A different number of blanks renumbers the keys outright.
    if (beforeBlanks.length !== afterBlanks.length) {
        return allBlankIndices(beforeBlanks, afterBlanks);
    }

    // A pure permutation — the same answers in different positions — is a
    // reorder, and it invalidates every schedule rather than just the positions
    // whose text differs: key #1 now asks for what key #2 used to ask for, so the
    // history stored under #1 belongs to #2. An unchanged multiset is what makes
    // it a reorder; a changed multiset means an answer was actually rewritten,
    // which is the in-place case below.
    const beforeAnswers = beforeBlanks.map(normalize).toSorted();
    const afterAnswers = afterBlanks.map(normalize).toSorted();
    const sameAnswers = beforeAnswers.every((answer, index) => answer === afterAnswers[index]);
    const someBlankMoved = beforeBlanks.some(
        (blank, index) => normalize(blank) !== normalize(afterBlanks[index]),
    );
    if (sameAnswers && someBlankMoved) return allBlankIndices(beforeBlanks, afterBlanks);

    // Otherwise the answers were edited in place: only the positions that now
    // hold a different answer are stale.
    return afterBlanks
        .map((blank, index) => (normalize(blank) === normalize(beforeBlanks[index]) ? -1 : index))
        .filter((index) => index !== -1);
}
