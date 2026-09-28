import { describe, it, expect } from 'vitest';
import { collectDeckCardStats, resolveDeckEmptyState } from '../deckCardStats';
import { orderDeck } from '../../../../domain/flashcards/engines/deck';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { ReviewState } from '../../../../domain/flashcards/engines/scheduler';

/** Fixed reference instant — never `new Date()`, so every expectation is a literal. */
const NOW = new Date('2026-09-27T12:00:00.000Z');

function recallQuestion(id: string, status: Question['status'] = 'published'): Question {
    return {
        id,
        materialId: 'mat-1',
        type: 'identification',
        prompt: `Prompt for ${id}`,
        payload: { type: 'identification', correctAnswer: `Answer ${id}` },
        difficulty: 'medium',
        points: 1,
        status,
        version: 1,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
    };
}

/** Three blanks, so it projects three independently scheduled cards. */
function clozeQuestion(id: string): Question {
    return {
        id,
        materialId: 'mat-1',
        type: 'fill_in_blank',
        prompt: 'Fill in the blank:',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ contains the ___.',
            blanks: ['nucleus', 'chromatin'],
        },
        difficulty: 'medium',
        points: 1,
        status: 'published',
        version: 1,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
    };
}

function quiz(id: string, title: string, questionIds: string[]): Quiz {
    return {
        id,
        materialId: 'mat-1',
        title,
        questionIds,
        items: questionIds.map((questionId, index) => ({
            quizId: id,
            questionId,
            questionVersion: 1,
            order: index + 1,
        })),
        status: 'published',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
    };
}

function review(key: string, dueAt: string): ReviewState {
    return {
        key,
        materialId: 'mat-1',
        repetitions: 1,
        easeFactor: 2.5,
        intervalDays: 1,
        dueAt,
        lapses: 0,
        reviewCount: 1,
    };
}

const SIX_HOURS_OUT = '2026-09-27T18:00:00.000Z';
const THREE_DAYS_OUT = '2026-09-30T12:00:00.000Z';

describe('collectDeckCardStats', () => {
    it('exposes each quiz question membership beside its card count', () => {
        const stats = collectDeckCardStats(
            [recallQuestion('q-1'), clozeQuestion('q-2')],
            [quiz('quiz-1', 'Practice Quiz', ['q-1', 'q-2']), quiz('quiz-2', 'Archived Quiz', ['q-9'])],
            {},
            NOW
        );

        // A two-blank cloze is two cards, so the quiz count is 3, not 2.
        expect(stats.cardsByQuizId.get('quiz-1')).toBe(3);
        expect(stats.questionIdsByQuizId.get('quiz-1')).toEqual(['q-1', 'q-2']);
        expect(stats.questionIdsByQuizId.get('quiz-2')).toEqual(['q-9']);
        expect(stats.totalCards).toBe(3);
    });
});

describe('resolveDeckEmptyState', () => {
    const questions = [recallQuestion('q-1'), recallQuestion('q-2')];
    const quizzes = [quiz('quiz-1', 'Practice Quiz', ['q-1']), quiz('quiz-2', 'Empty Quiz', ['q-9'])];

    it('reports no reason when the whole deck is studyable', () => {
        const stats = collectDeckCardStats(questions, quizzes, {}, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: null }, 'all', NOW);

        expect(state).toEqual({ studyableCardCount: 2, reason: null });
    });

    it('reports nothing due, with the earliest due instant, when no card is studyable', () => {
        const stats = collectDeckCardStats(questions, quizzes, {
            'q:q-1': review('q:q-1', THREE_DAYS_OUT),
            'q:q-2': review('q:q-2', SIX_HOURS_OUT),
        }, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: null }, 'due_only', NOW);

        expect(state.studyableCardCount).toBe(0);
        // The earliest instant, not merely one of them.
        expect(state.reason).toEqual({ kind: 'nothing_due', nextDueAt: SIX_HOURS_OUT });
    });

    it('counts the cards a study mode leaves behind rather than declaring an empty deck', () => {
        const stats = collectDeckCardStats(questions, quizzes, {
            'q:q-1': review('q:q-1', SIX_HOURS_OUT),
        }, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: null }, 'due_only', NOW);

        expect(state).toEqual({ studyableCardCount: 1, reason: null });
    });

    it('names the selected quiz when the filter scope holds no cards', () => {
        const stats = collectDeckCardStats(questions, quizzes, {}, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: quizzes[1] }, 'all', NOW);

        expect(state).toEqual({
            studyableCardCount: 0,
            reason: { kind: 'no_cards_in_selection', scopeTitle: 'Empty Quiz' },
        });
    });

    it('prefers the filter cause over the schedule cause when both apply', () => {
        // The quiz itself contributes no cards, so there is nothing to be due —
        // naming a date here would be a statement about a card the user cannot see.
        const stats = collectDeckCardStats(questions, quizzes, {
            'q:q-1': review('q:q-1', THREE_DAYS_OUT),
        }, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: quizzes[1] }, 'due_only', NOW);

        expect(state.reason).toEqual({ kind: 'no_cards_in_selection', scopeTitle: 'Empty Quiz' });
    });

    it('quotes the next due instant from the filtered pool, never the whole material', () => {
        // q-1 is due in six hours but is NOT in quiz-2; quiz-2's own only card is
        // due in three days. The whole-material earliest would be six hours.
        const scopedQuestions = [recallQuestion('q-1'), recallQuestion('q-2')];
        const scopedQuizzes = [quiz('quiz-1', 'Practice Quiz', ['q-1']), quiz('quiz-2', 'Later Quiz', ['q-2'])];
        const stats = collectDeckCardStats(scopedQuestions, scopedQuizzes, {
            'q:q-1': review('q:q-1', SIX_HOURS_OUT),
            'q:q-2': review('q:q-2', THREE_DAYS_OUT),
        }, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: scopedQuizzes[1] }, 'due_only', NOW);

        expect(state.reason).toEqual({ kind: 'nothing_due', nextDueAt: THREE_DAYS_OUT });
    });

    it('reports a missing due date plainly when no schedule can be read', () => {
        const stats = collectDeckCardStats(questions, quizzes, {
            'q:q-1': review('q:q-1', 'not-a-date'),
            'q:q-2': review('q:q-2', 'not-a-date'),
        }, NOW);

        const state = resolveDeckEmptyState(stats, { quiz: null }, 'due_only', NOW);

        // An unreadable `dueAt` never satisfies `isDue`, so the deck is empty and
        // there is genuinely no instant to quote.
        expect(state.reason).toEqual({ kind: 'nothing_due', nextDueAt: null });
    });

    it('treats a quiz the stats do not know as an empty scope', () => {
        const stats = collectDeckCardStats(questions, quizzes, {}, NOW);

        const state = resolveDeckEmptyState(
            stats,
            { quiz: quiz('quiz-archived', 'Archived Quiz', ['q-1']) },
            'all',
            NOW
        );

        expect(state.reason).toEqual({
            kind: 'no_cards_in_selection',
            scopeTitle: 'Archived Quiz',
        });
    });

    it('disagrees with nothing: a reason is set exactly when orderDeck returns no cards', () => {
        // The disabled Start button and the screen's `ordered.length === 0` guard
        // must never draw the line in different places.
        const cases: { reviews: Record<string, ReviewState>; mode: 'due_only' | 'all'; quiz: Quiz | null }[] = [
            { reviews: {}, mode: 'due_only', quiz: null },
            { reviews: {}, mode: 'all', quiz: null },
            { reviews: {}, mode: 'due_only', quiz: quizzes[0] },
            { reviews: {}, mode: 'all', quiz: quizzes[1] },
            {
                reviews: { 'q:q-1': review('q:q-1', SIX_HOURS_OUT), 'q:q-2': review('q:q-2', THREE_DAYS_OUT) },
                mode: 'due_only',
                quiz: null,
            },
            {
                reviews: { 'q:q-1': review('q:q-1', SIX_HOURS_OUT) },
                mode: 'due_only',
                quiz: null,
            },
            {
                reviews: { 'q:q-1': review('q:q-1', SIX_HOURS_OUT) },
                mode: 'due_only',
                quiz: quizzes[0],
            },
        ];

        for (const testCase of cases) {
            const stats = collectDeckCardStats(questions, quizzes, testCase.reviews, NOW);
            const state = resolveDeckEmptyState(stats, { quiz: testCase.quiz }, testCase.mode, NOW);

            const questionIds = testCase.quiz ? new Set(testCase.quiz.questionIds) : null;
            const scopedCards = questionIds
                ? stats.cards.filter((card) => questionIds.has(card.source.questionId))
                : stats.cards;

            expect(state.reason !== null).toBe(
                orderDeck(scopedCards, testCase.reviews, NOW, { studyMode: testCase.mode }).length === 0
            );
            expect(state.studyableCardCount).toBe(
                orderDeck(scopedCards, testCase.reviews, NOW, { studyMode: testCase.mode }).length
            );
        }
    });
});
