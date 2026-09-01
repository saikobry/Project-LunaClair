import { describe, expect, it } from 'vitest';
import { MultipleChoiceStrategy } from '../MultipleChoiceStrategy';
import type { Question } from '../../Question';

describe('MultipleChoiceStrategy', () => {
    const strategy = new MultipleChoiceStrategy();

    const mockQuestion: Question = {
        id: 'q-mcq-1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'What is the powerhouse of the cell?',
        payload: {
            type: 'multiple_choice',
            choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
            correctIndex: 1,
        },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('validate', () => {
        it('validates string index within choice boundaries', () => {
            expect(strategy.validate(mockQuestion, '0')).toBe(true);
            expect(strategy.validate(mockQuestion, '1')).toBe(true);
            expect(strategy.validate(mockQuestion, '3')).toBe(true);
        });

        it('rejects non-string values', () => {
            expect(strategy.validate(mockQuestion, 1 as unknown as string)).toBe(false);
            expect(strategy.validate(mockQuestion, ['1'])).toBe(false);
            expect(strategy.validate(mockQuestion, true)).toBe(false);
            expect(strategy.validate(mockQuestion, null as unknown as string)).toBe(false);
        });

        it('rejects out-of-range or negative indices', () => {
            expect(strategy.validate(mockQuestion, '-1')).toBe(false);
            expect(strategy.validate(mockQuestion, '4')).toBe(false);
            expect(strategy.validate(mockQuestion, '99')).toBe(false);
        });

        it('rejects non-integer strings', () => {
            expect(strategy.validate(mockQuestion, '1.5')).toBe(false);
            expect(strategy.validate(mockQuestion, 'abc')).toBe(false);
        });
    });

    describe('grade', () => {
        it('awards full question points when index matches correctIndex', () => {
            const result = strategy.grade(mockQuestion, '1');
            expect(result.isCorrect).toBe(true);
            expect(result.earnedPoints).toBe(5);
        });

        it('awards 0 points when index does not match correctIndex', () => {
            const result = strategy.grade(mockQuestion, '0');
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });
    });
});
