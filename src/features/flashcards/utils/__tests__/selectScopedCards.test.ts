import { describe, it, expect } from 'vitest';
import { selectScopedCards, resolveSelectedQuiz } from '../selectScopedCards';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { Flashcard } from '../../../../domain/flashcards/models/Flashcard';

function recallCard(questionId: string, index?: number): Flashcard {
    return {
        key: index !== undefined ? `q:${questionId}#${index}` : `q:${questionId}`,
        kind: 'recall',
        materialId: 'mat-1',
        front: `Prompt for ${questionId}`,
        back: `Answer for ${questionId}`,
        difficulty: 'medium',
        source: {
            type: 'question',
            questionId,
        },
    };
}

function quiz(id: string, title: string, questionIds: string[], orders?: number[]): Quiz {
    return {
        id,
        materialId: 'mat-1',
        title,
        questionIds,
        items: questionIds.map((questionId, index) => ({
            quizId: id,
            questionId,
            questionVersion: 1,
            order: orders ? orders[index] : index + 1,
        })),
        status: 'published',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
    };
}

describe('resolveSelectedQuiz', () => {
    const quiz1 = quiz('quiz-1', 'Practice Quiz', ['q-1']);
    const quiz2 = quiz('quiz-2', 'Master Quiz', ['q-2']);
    const quizzes = [quiz1, quiz2];

    it('resolves null when selectedQuizId is omitted, null, or "all" (unfiltered scope)', () => {
        expect(resolveSelectedQuiz(quizzes)).toBeNull();
        expect(resolveSelectedQuiz(quizzes, undefined)).toBeNull();
        expect(resolveSelectedQuiz(quizzes, null)).toBeNull();
        expect(resolveSelectedQuiz(quizzes, 'all')).toBeNull();
    });

    it('resolves the matching Quiz when a valid quiz ID is passed', () => {
        expect(resolveSelectedQuiz(quizzes, 'quiz-1')).toBe(quiz1);
        expect(resolveSelectedQuiz(quizzes, 'quiz-2')).toBe(quiz2);
    });

    it('resolves undefined for a stale or unknown quiz ID, failing closed to 0 cards', () => {
        const result = resolveSelectedQuiz(quizzes, 'stale-or-deleted-quiz-id');
        expect(result).toBeUndefined();

        // Proves that when this unresolved outcome is passed to selectScopedCards, it returns []
        const cards = [recallCard('q-1'), recallCard('q-2')];
        expect(selectScopedCards(cards, result)).toEqual([]);
    });
});

describe('selectScopedCards', () => {
    const cardQ1 = recallCard('q-1');
    const cardQ2 = recallCard('q-2');
    const cardQ3_0 = recallCard('q-3', 0);
    const cardQ3_1 = recallCard('q-3', 1);
    const allCards = [cardQ1, cardQ2, cardQ3_0, cardQ3_1];

    it('returns all cards when quiz is null (no filter / whole material)', () => {
        const result = selectScopedCards(allCards, null);
        expect(result).toBe(allCards);
        expect(result).toHaveLength(4);
    });

    it('returns empty array when quiz is undefined (unknown quiz selection)', () => {
        const result = selectScopedCards(allCards, undefined);
        expect(result).toEqual([]);
    });

    it('returns empty array when quiz is not in questionIdsByQuizId ReadonlyMap', () => {
        const testQuiz = quiz('quiz-unknown', 'Unknown Quiz', ['q-1']);
        const questionIdsByQuizId: ReadonlyMap<string, readonly string[]> = new Map([['quiz-known', ['q-1']]]);

        const result = selectScopedCards(allCards, testQuiz, questionIdsByQuizId);
        expect(result).toEqual([]);
    });

    it('returns empty array when quiz has no questions', () => {
        const emptyQuiz = quiz('quiz-empty', 'Empty Quiz', []);
        const result = selectScopedCards(allCards, emptyQuiz);
        expect(result).toEqual([]);
    });

    it('filters cards by question id while preserving card key identity for cloze blanks', () => {
        const testQuiz = quiz('quiz-cloze', 'Cloze Quiz', ['q-3']);
        const result = selectScopedCards(allCards, testQuiz);

        expect(result).toHaveLength(2);
        expect(result[0].key).toBe('q:q-3#0');
        expect(result[1].key).toBe('q:q-3#1');
        expect(result[0].source.questionId).toBe('q-3');
        expect(result[1].source.questionId).toBe('q-3');
    });

    it('orders cards according to quiz item order while preserving stable per-blank order', () => {
        // Authoring order: q-2 is first (order 1), q-3 is second (order 2), q-1 is third (order 3)
        const orderedQuiz = quiz('quiz-ordered', 'Ordered Quiz', ['q-1', 'q-2', 'q-3'], [3, 1, 2]);

        const result = selectScopedCards(allCards, orderedQuiz);

        expect(result.map((c) => c.key)).toEqual(['q:q-2', 'q:q-3#0', 'q:q-3#1', 'q:q-1']);
    });
});
