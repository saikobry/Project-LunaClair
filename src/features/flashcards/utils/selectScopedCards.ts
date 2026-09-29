import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Flashcard } from '../../../domain/flashcards/models/Flashcard';

/**
 * Resolves a selected quiz ID against the available quizzes.
 *
 * Scoping rules:
 * - Omitted, null, or `'all'` -> `null` (no filter: study the whole material).
 * - Matching quiz ID -> `Quiz` (resolved quiz scope).
 * - Stale, unknown, or missing quiz ID -> `undefined` (explicitly unresolved: fail-closed to 0 cards).
 */
export function resolveSelectedQuiz(
    quizzes: readonly Quiz[],
    selectedQuizId?: string | null
): Quiz | null | undefined {
    if (!selectedQuizId || selectedQuizId === 'all') {
        return null;
    }
    const found = quizzes.find((q) => q.id === selectedQuizId);
    return found ?? undefined;
}

/**
 * Filters and orders cards for a deck selection.
 *
 * Scoping rules:
 * - A `null` quiz means the whole material (no filter): every card is retained.
 * - An `undefined` quiz, or a quiz not present in `questionIdsByQuizId`, represents an
 *   unknown or empty selection and resolves to no cards (`[]`), NOT "all cards".
 *   An unknown quiz is not the same as no filter.
 * - Matching uses `card.source.questionId` to identify which cards belong to the
 *   quiz's questions, but card identity is strictly `card.key` (which may be
 *   plural for multi-blank questions).
 * - When `quiz.items` provides authoring order, cards are sorted accordingly,
 *   preserving the relative order of per-blank cards for the same question.
 */
export function selectScopedCards(
    cards: readonly Flashcard[],
    quiz: Quiz | null | undefined,
    questionIdsByQuizId?: ReadonlyMap<string, readonly string[]>
): Flashcard[] {
    if (quiz === null) {
        return cards as Flashcard[];
    }
    if (!quiz) {
        return [];
    }

    const questionIds = questionIdsByQuizId ? questionIdsByQuizId.get(quiz.id) : quiz.questionIds;
    if (!questionIds || questionIds.length === 0) {
        return [];
    }

    const idSet = new Set(questionIds);
    const matchingCards = cards.filter((card) => idSet.has(card.source.questionId));

    if (quiz.items && quiz.items.length > 0) {
        const order = new Map(quiz.items.map((item) => [item.questionId, item.order]));
        return matchingCards.toSorted(
            (a, b) =>
                (order.get(a.source.questionId) ?? Number.MAX_SAFE_INTEGER) -
                (order.get(b.source.questionId) ?? Number.MAX_SAFE_INTEGER)
        );
    }

    return matchingCards;
}
