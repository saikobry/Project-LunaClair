import type { Question } from '../../quiz/models/Question';
import type { Flashcard } from '../models/Flashcard';
import type { ReviewState } from '../engines/scheduler';
import { isDue } from '../engines/scheduler';
import { questionToCard } from './questionToCard';

export type DeckStudyMode = 'due_only' | 'all';

export interface DeckOrderOptions {
    studyMode?: DeckStudyMode;
}

export function orderDeck(
    questions: Question[],
    reviews: Record<string, ReviewState>,
    now: Date = new Date(),
    options?: DeckOrderOptions
): Flashcard[] {
    const cards = questions.map(questionToCard);
    const studyMode = options?.studyMode ?? 'all';

    const filteredCards = studyMode === 'due_only'
        ? cards.filter((card) => isDue(reviews[card.key], now))
        : cards;

    const dueCards: { card: Flashcard; dueAtMs: number }[] = [];
    const newCards: Flashcard[] = [];
    const notDueCards: { card: Flashcard; dueAtMs: number }[] = [];

    for (const card of filteredCards) {
        const rev = reviews[card.key];
        if (!rev || rev.reviewCount === 0) {
            newCards.push(card);
        } else {
            const dueAtMs = new Date(rev.dueAt).getTime();
            if (dueAtMs <= now.getTime()) {
                dueCards.push({ card, dueAtMs });
            } else {
                notDueCards.push({ card, dueAtMs });
            }
        }
    }

    dueCards.sort((a, b) => a.dueAtMs - b.dueAtMs);
    notDueCards.sort((a, b) => a.dueAtMs - b.dueAtMs);

    return [
        ...dueCards.map((d) => d.card),
        ...newCards,
        ...notDueCards.map((nd) => nd.card),
    ];
}
