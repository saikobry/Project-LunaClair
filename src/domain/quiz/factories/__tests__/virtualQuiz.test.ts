import { describe, expect, it } from 'vitest';
import {
    buildUnifiedQuestionSetFromQuizzes,
    createVirtualQuizFromQuizzes,
} from '../virtualQuiz';
import type { Quiz } from '../../models/Quiz';
import type { Question } from '../../models/Question';

describe('virtualQuiz', () => {
    const q1: Question = {
        id: 'q-1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'Q1',
        payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T01:00:00.000Z',
        updatedAt: '2026-09-01T01:00:00.000Z',
    };

    const q2: Question = {
        id: 'q-2',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Q2',
        payload: { type: 'true_false', correctAnswer: true },
        points: 10,
        difficulty: 'medium',
        version: 2,
        status: 'published',
        createdAt: '2026-09-01T02:00:00.000Z',
        updatedAt: '2026-09-01T02:00:00.000Z',
    };

    const q3: Question = {
        id: 'q-3',
        materialId: 'mat-1',
        type: 'identification',
        prompt: 'Q3',
        payload: { type: 'identification', correctAnswer: 'Ans' },
        points: 15,
        difficulty: 'hard',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T03:00:00.000Z',
        updatedAt: '2026-09-01T03:00:00.000Z',
    };

    const quizA: Quiz = {
        id: 'quiz-a',
        materialId: 'mat-1',
        title: 'Quiz A',
        questionIds: ['q-1', 'q-2'],
        items: [
            { quizId: 'quiz-a', questionId: 'q-1', questionVersion: 1, order: 0 },
            { quizId: 'quiz-a', questionId: 'q-2', questionVersion: 2, order: 1 },
        ],
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const quizB: Quiz = {
        id: 'quiz-b',
        materialId: 'mat-1',
        title: 'Quiz B',
        questionIds: ['q-2', 'q-3'], // Shares q-2 with Quiz A
        items: [
            { quizId: 'quiz-b', questionId: 'q-2', questionVersion: 2, order: 0 },
            { quizId: 'quiz-b', questionId: 'q-3', questionVersion: 1, order: 1 },
        ],
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('buildUnifiedQuestionSetFromQuizzes', () => {
        it('deduplicates shared questions across quizzes deterministically', () => {
            const unified = buildUnifiedQuestionSetFromQuizzes([quizA, quizB], [q1, q2, q3]);

            expect(unified).toHaveLength(3);
            expect(unified.map((q) => q.id)).toEqual(['q-1', 'q-2', 'q-3']);
        });

        it('returns empty array when no questions match', () => {
            const unified = buildUnifiedQuestionSetFromQuizzes([quizA], []);
            expect(unified).toEqual([]);
        });
    });

    describe('createVirtualQuizFromQuizzes', () => {
        it('creates in-memory virtual quiz with stable sorted composite ID', () => {
            const virtualQuiz = createVirtualQuizFromQuizzes({
                quizIds: ['quiz-b', 'quiz-a'], // Passed unsorted
                quizzes: [quizA, quizB],
                questions: [q1, q2, q3],
            });

            expect(virtualQuiz.id).toBe('virtual:quizzes:quiz-a|quiz-b');
            expect(virtualQuiz.title).toBe('Unified Quiz (2 quizzes)');
            expect(virtualQuiz.questionIds).toEqual(['q-1', 'q-2', 'q-3']);
            expect(virtualQuiz.items).toHaveLength(3);
            expect(virtualQuiz.items[0]).toEqual({
                quizId: 'virtual:quizzes:quiz-a|quiz-b',
                questionId: 'q-1',
                questionVersion: 1,
                order: 1,
                points: 5,
            });
            expect(virtualQuiz.items[1]).toEqual({
                quizId: 'virtual:quizzes:quiz-a|quiz-b',
                questionId: 'q-2',
                questionVersion: 2,
                order: 2,
                points: 10,
            });
        });
    });
});
