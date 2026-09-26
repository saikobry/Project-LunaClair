import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Flashcard } from '../../../domain/flashcards/models/Flashcard';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import { isDue } from '../../../domain/flashcards/engines/scheduler';
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
    for (const quiz of quizzes) {
        let count = 0;
        for (const questionId of quiz.questionIds) {
            count += cardsPerQuestionId.get(questionId) ?? 0;
        }
        cardsByQuizId.set(quiz.id, count);
    }

    return { cards, totalCards: cards.length, dueCount, newCount, cardsByQuizId };
}
