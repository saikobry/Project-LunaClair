import { describe, expect, it } from 'vitest';
import {
    makeDraftTempId,
    makeDraftId,
    createEmptyQuizDraft,
    createQuizDraftFromQuiz,
} from '../QuizDraft';
import type { Quiz } from '../../../../domain/quiz/Quiz';
import type { Question } from '../../../../domain/quiz/Question';

describe('QuizDraft application models and helpers', () => {
    describe('makeDraftTempId', () => {
        it('generates a card tempId with prefix and unique structure', () => {
            const id1 = makeDraftTempId();
            const id2 = makeDraftTempId();

            expect(id1).toMatch(/^card-/);
            expect(id2).toMatch(/^card-/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('makeDraftId', () => {
        it('generates a draftId with prefix', () => {
            const id1 = makeDraftId();
            const id2 = makeDraftId();

            expect(id1).toMatch(/^draft-/);
            expect(id2).toMatch(/^draft-/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('createEmptyQuizDraft', () => {
        it('creates a clean default draft in memory', () => {
            const before = new Date().toISOString();
            const draft = createEmptyQuizDraft('mat-bio-1', 'quiz-opt-1');
            const after = new Date().toISOString();

            expect(draft.draftId).toMatch(/^draft-/);
            expect(draft.quizId).toBe('quiz-opt-1');
            expect(draft.materialId).toBe('mat-bio-1');
            expect(draft.title).toBe('');
            expect(draft.passingPercentage).toBe(70);
            expect(draft.items).toEqual([]);
            expect(draft.isDirty).toBe(false);
            expect(draft.updatedAt >= before).toBe(true);
            expect(draft.updatedAt <= after).toBe(true);
        });
    });

    describe('createQuizDraftFromQuiz', () => {
        const mockQuestions: Question[] = [
            {
                id: 'q1',
                materialId: 'mat-bio-1',
                type: 'multiple_choice',
                prompt: 'Prompt 1',
                payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
                points: 5,
                difficulty: 'easy',
                version: 1,
                status: 'published',
                tags: ['bio'],
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            },
            {
                id: 'q2',
                materialId: 'mat-bio-1',
                type: 'true_false',
                prompt: 'Prompt 2',
                payload: { type: 'true_false', correctAnswer: true },
                points: 10,
                difficulty: 'medium',
                version: 1,
                status: 'published',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            },
        ];

        const mockQuiz: Quiz = {
            id: 'quiz-1',
            materialId: 'mat-bio-1',
            title: 'Cell Biology Quiz',
            description: 'Test on cell structures',
            passingPercentage: 80,
            status: 'published',
            items: [
                { quizId: 'quiz-1', questionId: 'q2', questionVersion: 1, order: 0, points: 15 },
                { quizId: 'quiz-1', questionId: 'q1', questionVersion: 1, order: 1, points: 5 },
                { quizId: 'quiz-1', questionId: 'q-missing', questionVersion: 1, order: 2 },
            ],
            questionIds: ['q2', 'q1', 'q-missing'],
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
        };

        it('seeds a draft from quiz and questions respecting order and point overrides', () => {
            const draft = createQuizDraftFromQuiz(mockQuiz, mockQuestions);

            expect(draft.quizId).toBe('quiz-1');
            expect(draft.materialId).toBe('mat-bio-1');
            expect(draft.title).toBe('Cell Biology Quiz');
            expect(draft.description).toBe('Test on cell structures');
            expect(draft.passingPercentage).toBe(80);
            expect(draft.isDirty).toBe(false);

            // Filtered out missing question and maintained order: q2 first, then q1
            expect(draft.items).toHaveLength(2);

            expect(draft.items[0].questionId).toBe('q2');
            expect(draft.items[0].prompt).toBe('Prompt 2');
            expect(draft.items[0].points).toBe(15); // quiz item override
            expect(draft.items[0].tempId).toMatch(/^card-/);

            expect(draft.items[1].questionId).toBe('q1');
            expect(draft.items[1].prompt).toBe('Prompt 1');
            expect(draft.items[1].points).toBe(5);
            expect(draft.items[1].tags).toEqual(['bio']);
        });
    });
});
