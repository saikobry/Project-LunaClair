import type { Flashcard } from '../models/Flashcard';
import type { ReviewState } from '../engines/scheduler';
import { isDue } from '../engines/scheduler';

export type DeckStudyMode = 'due_only' | 'all';

export interface DeckOrderOptions {
    studyMode?: DeckStudyMode;
}

/**
 * Buckets already-projected cards into due → new → not-due, sorting the two
 * reviewed buckets by `dueAt`. Incoming order is preserved verbatim in the
 * `new` bucket only, so the caller's projection order (e.g. a quiz's
 * `items[].order`) defines the first pass and SM-2 supersedes it afterwards.
 *
 * Projection is the caller's job: a `fill_in_blank` question can expand to one
 * card per blank, and those cards inherit that question's slot in the incoming
 * order. Passing questions here would make that cardinality invisible.
 */
export function orderDeck(
    cards: Flashcard[],
    reviews: Record<string, ReviewState>,
    now: Date = new Date(),
    options?: DeckOrderOptions
): Flashcard[] {
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
