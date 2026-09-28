import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Flashcard } from '../../../domain/flashcards/models/Flashcard';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import { isDue } from '../../../domain/flashcards/engines/scheduler';
import type { DeckStudyMode } from '../../../domain/flashcards/engines/deck';
import { questionToCards } from '../../../domain/flashcards/engines/questionToCards';

export interface DeckCardStats {
    /** Every projected card for the non-archived questions, in question order. */
    cards: Flashcard[];
    totalCards: number;
    /** Cards studyable now: never-reviewed cards plus reviewed cards past `dueAt`. */
    dueCount: number;
    newCount: number;
    /** Projected card count per quiz id, for the deck-size filter. */
    cardsByQuizId: Map<string, number>;
    /**
     * Question ids per quiz id — the membership the deck-size counts above are
     * built from, kept so a selection can resolve its own card pool without a
     * second projection.
     */
    questionIdsByQuizId: Map<string, string[]>;
    /** The review map the counts were derived from, so scope questions can reuse it. */
    reviews: Record<string, ReviewState>;
}

/**
 * Deck-level counts for the setup view.
 *
 * Everything here counts **cards, not questions**. A `fill_in_blank` question
 * projects to one card per blank, so a question count would make the setup view
 * promise fewer cards than the session actually shows — and the "Due Cards
 * Only" study mode would then be a different session than the one advertised.
 */
export function collectDeckCardStats(
    questions: Question[],
    quizzes: Quiz[],
    reviews: Record<string, ReviewState>,
    now: Date
): DeckCardStats {
    const cards = questions.flatMap(questionToCards);

    let dueCount = 0;
    let newCount = 0;
    for (const card of cards) {
        const rev = reviews[card.key];
        if (!rev || rev.reviewCount === 0) {
            newCount++;
            dueCount++; // New cards are due immediately
        } else if (isDue(rev, now)) {
            dueCount++;
        }
    }

    const cardsPerQuestionId = new Map<string, number>();
    for (const card of cards) {
        const questionId = card.source.questionId;
        cardsPerQuestionId.set(questionId, (cardsPerQuestionId.get(questionId) ?? 0) + 1);
    }

    const cardsByQuizId = new Map<string, number>();
    const questionIdsByQuizId = new Map<string, string[]>();
    for (const quiz of quizzes) {
        let count = 0;
        for (const questionId of quiz.questionIds) {
            count += cardsPerQuestionId.get(questionId) ?? 0;
        }
        cardsByQuizId.set(quiz.id, count);
        questionIdsByQuizId.set(quiz.id, [...quiz.questionIds]);
    }

    return {
        cards,
        totalCards: cards.length,
        dueCount,
        newCount,
        cardsByQuizId,
        questionIdsByQuizId,
        reviews,
    };
}

/** The scope a session is limited to: one quiz's cards, or every quiz's. */
export interface DeckSelection {
    /** The selected quiz, or `null` for the whole material. */
    quiz: Quiz | null;
}

export type DeckEmptyReason =
    /**
     * The selected scope projects no cards at all. A filter result, not a study
     * problem: nothing about scheduling is involved.
     */
    | { kind: 'no_cards_in_selection'; scopeTitle: string | null }
    /**
     * The scope has cards and not one of them is studyable yet, because every
     * schedule points into the future. `nextDueAt` is the earliest such instant
     * **in this scope**, or `null` when no card carries a readable due date.
     */
    | { kind: 'nothing_due'; nextDueAt: string | null };

export interface DeckEmptyState {
    /** Cards the current selection + study mode would put in a session. */
    studyableCardCount: number;
    /** `null` when a session can start. */
    reason: DeckEmptyReason | null;
}

/**
 * Why the current selection + study mode yields an empty deck, or `null` when it
 * does not.
 *
 * The studyability predicate is `isDue` on the same projected cards and review
 * map `orderDeck` receives, so "Start is disabled" and "`orderDeck` would return
 * nothing" cannot disagree. The quoted next due time is read from the *scoped*
 * cards, never the whole material, so it can never announce a date for a card the
 * selected quiz filters out.
 */
export function resolveDeckEmptyState(
    stats: DeckCardStats,
    selection: DeckSelection,
    studyMode: DeckStudyMode,
    now: Date
): DeckEmptyState {
    const scopedCards = selectScopedCards(stats, selection.quiz);

    let studyableCardCount = 0;
    let earliestDueAtMs = Number.POSITIVE_INFINITY;
    let earliestDueAt: string | null = null;

    for (const card of scopedCards) {
        if (studyMode !== 'due_only' || isDue(stats.reviews[card.key], now)) {
            studyableCardCount++;
        }

        const review = stats.reviews[card.key];
        if (!review) continue;
        const dueAtMs = new Date(review.dueAt).getTime();
        if (!Number.isFinite(dueAtMs) || dueAtMs >= earliestDueAtMs) continue;
        earliestDueAtMs = dueAtMs;
        earliestDueAt = review.dueAt;
    }

    if (studyableCardCount > 0) {
        return { studyableCardCount, reason: null };
    }

    if (scopedCards.length === 0) {
        return {
            studyableCardCount: 0,
            reason: { kind: 'no_cards_in_selection', scopeTitle: selection.quiz?.title ?? null },
        };
    }

    return { studyableCardCount: 0, reason: { kind: 'nothing_due', nextDueAt: earliestDueAt } };
}

/**
 * The cards a selection scopes to. A quiz contributes the projected cards of the
 * questions it lists, exactly as the per-quiz counts above are built; an unknown
 * quiz resolves to nothing, and the whole scope is every projected card.
 */
function selectScopedCards(stats: DeckCardStats, quiz: Quiz | null): Flashcard[] {
    if (!quiz) return stats.cards;

    const questionIds = stats.questionIdsByQuizId.get(quiz.id);
    if (!questionIds) return [];

    const idSet = new Set(questionIds);
    return stats.cards.filter((card) => idSet.has(card.source.questionId));
}
