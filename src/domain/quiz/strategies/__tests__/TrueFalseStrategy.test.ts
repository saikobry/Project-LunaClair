import { describe, expect, it } from 'vitest';
import { TrueFalseStrategy } from '../TrueFalseStrategy';
import type { Question } from '../../models/Question';

describe('TrueFalseStrategy', () => {
    const strategy = new TrueFalseStrategy();

    const mockQuestionTrue: Question = {
        id: 'q-tf-1',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'DNA is a double helix.',
        payload: {
            type: 'true_false',
            correctAnswer: true,
        },
        points: 4,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('validate', () => {
        it('validates boolean values', () => {
            expect(strategy.validate(mockQuestionTrue, true)).toBe(true);
            expect(strategy.validate(mockQuestionTrue, false)).toBe(true);
        });

        it('rejects non-boolean values', () => {
            expect(strategy.validate(mockQuestionTrue, 'true')).toBe(false);
            expect(strategy.validate(mockQuestionTrue, 'false')).toBe(false);
            expect(strategy.validate(mockQuestionTrue, 1 as unknown as boolean)).toBe(false);
            expect(strategy.validate(mockQuestionTrue, [true] as unknown as string[])).toBe(false);
            expect(strategy.validate(mockQuestionTrue, null as unknown as boolean)).toBe(false);
        });
    });

    describe('grade', () => {
        it('awards points when boolean matches correctAnswer', () => {
            const result = strategy.grade(mockQuestionTrue, true);
            expect(result.isCorrect).toBe(true);
            expect(result.earnedPoints).toBe(4);
        });

        it('awards 0 points when boolean mismatches correctAnswer', () => {
            const result = strategy.grade(mockQuestionTrue, false);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });
    });
});
