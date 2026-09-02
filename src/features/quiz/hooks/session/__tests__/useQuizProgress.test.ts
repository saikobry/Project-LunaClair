import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizProgress } from '../useQuizProgress';
import type { Question } from '../../../../../domain/quiz/models/Question';

describe('useQuizProgress', () => {
    const mockQuestions: Question[] = [
        {
            id: 'q-1',
            materialId: 'mat-1',
            type: 'multiple_choice',
            difficulty: 'easy',
            status: 'published',
            version: 1,
            points: 1,
            prompt: 'Question 1',
            payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-2',
            materialId: 'mat-1',
            type: 'true_false',
            difficulty: 'medium',
            status: 'published',
            version: 1,
            points: 2,
            prompt: 'Question 2',
            payload: { type: 'true_false', correctAnswer: true },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-3',
            materialId: 'mat-1',
            type: 'identification',
            difficulty: 'hard',
            status: 'published',
            version: 1,
            points: 3,
            prompt: 'Question 3',
            payload: { type: 'identification', correctAnswer: 'nucleus' },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    it('initializes with default state for non-empty questions', () => {
        const { result } = renderHook(() => useQuizProgress(mockQuestions));

        expect(result.current.currentIndex).toBe(0);
        expect(result.current.currentQuestion).toEqual(mockQuestions[0]);
        expect(result.current.totalQuestions).toBe(3);
        expect(result.current.answeredCount).toBe(0);
        expect(result.current.isLastQuestion).toBe(false);
        expect(result.current.answers.size).toBe(0);
    });

    it('handles empty questions gracefully', () => {
        const { result } = renderHook(() => useQuizProgress([]));

        expect(result.current.currentIndex).toBe(0);
        expect(result.current.currentQuestion).toBeNull();
        expect(result.current.totalQuestions).toBe(0);
        expect(result.current.answeredCount).toBe(0);
        expect(result.current.isLastQuestion).toBe(false);
    });

    it('records and updates answers correctly', () => {
        const { result } = renderHook(() => useQuizProgress(mockQuestions));

        act(() => {
            result.current.setAnswer('q-1', '0');
        });

        expect(result.current.answeredCount).toBe(1);
        expect(result.current.answers.get('q-1')).toBe('0');

        // Updating existing answer updates value without double counting
        act(() => {
            result.current.setAnswer('q-1', '1');
        });

        expect(result.current.answeredCount).toBe(1);
        expect(result.current.answers.get('q-1')).toBe('1');

        // Answering second question
        act(() => {
            result.current.setAnswer('q-2', true);
        });

        expect(result.current.answeredCount).toBe(2);
        expect(result.current.answers.get('q-2')).toBe(true);
    });

    it('navigates next, previous, and to specific indices within bounds', () => {
        const { result } = renderHook(() => useQuizProgress(mockQuestions));

        act(() => {
            result.current.goNext();
        });
        expect(result.current.currentIndex).toBe(1);
        expect(result.current.currentQuestion).toEqual(mockQuestions[1]);
        expect(result.current.isLastQuestion).toBe(false);

        act(() => {
            result.current.goNext();
        });
        expect(result.current.currentIndex).toBe(2);
        expect(result.current.isLastQuestion).toBe(true);

        // goNext at last question stays at last index
        act(() => {
            result.current.goNext();
        });
        expect(result.current.currentIndex).toBe(2);

        // goPrev navigates backwards
        act(() => {
            result.current.goPrev();
        });
        expect(result.current.currentIndex).toBe(1);

        // goTo navigates directly
        act(() => {
            result.current.goTo(0);
        });
        expect(result.current.currentIndex).toBe(0);

        // goPrev at first question stays at 0
        act(() => {
            result.current.goPrev();
        });
        expect(result.current.currentIndex).toBe(0);
    });

    it('resets progress and answers back to initial state', () => {
        const { result } = renderHook(() => useQuizProgress(mockQuestions));

        act(() => {
            result.current.setAnswer('q-1', '0');
            result.current.setAnswer('q-2', true);
            result.current.goTo(2);
        });

        expect(result.current.currentIndex).toBe(2);
        expect(result.current.answeredCount).toBe(2);

        act(() => {
            result.current.reset();
        });

        expect(result.current.currentIndex).toBe(0);
        expect(result.current.answeredCount).toBe(0);
        expect(result.current.answers.size).toBe(0);
    });
});
