import type { Question } from '../../quiz/models/Question';
import { questionToCards } from '../../flashcards/engines/questionToCards';

/**
 * The card pool an analytics breakdown is measured against: the set of card
 * **keys** a set of in-scope questions projects.
 *
 * **A card is not a question.** `questionToCards` projects 1..N cards per
 * question — every non-cloze type is 1:1, a `fill_in_blank` question is 1:N
 * (one card per blank, each with its own SM-2 schedule). So a question count is
 * a different, wrong number: a library whose single 3-blank cloze question sits
 * beside two 1:1 questions holds **five** cards, and the "N total flashcards"
 * figure has to say five. The pool is therefore the union of the projected
 * `card.key` values, taken through the *same* `questionToCards` projection the
 * study deck is built from, so the analytics denominator and the deck can never
 * disagree about what a card is.
 *
 * Every projected card counts, `multiple_choice` and `multiple_select` included:
 * the player renders their options as a genuine study interaction, so
 * discounting them would understate the deck the learner actually works
 * through.
 *
 * **Archived questions contribute no keys.** Archiving is the app's soft
 * delete, so an archived question projects no card and must not widen the pool.
 * The filter lives here rather than in each caller so the global and
 * per-material scopes cannot drift apart on what "in scope" means.
 *
 * Pure: the input array and every question in it are left untouched.
 */
export function buildCardKeyPool(questions: readonly Question[]): Set<string> {
    const cardKeys = new Set<string>();

    for (const question of questions) {
        if (question.status === 'archived') continue;
        for (const card of questionToCards(question)) {
            cardKeys.add(card.key);
        }
    }

    return cardKeys;
}
