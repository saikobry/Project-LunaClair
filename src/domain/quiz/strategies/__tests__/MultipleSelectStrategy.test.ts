import { describe, expect, it } from 'vitest';
import { MultipleSelectStrategy } from '../MultipleSelectStrategy';
import type { Question } from '../../models/Question';

describe('MultipleSelectStrategy', () => {
    const strategy = new MultipleSelectStrategy();

    const mockQuestion: Question = {
        id: 'q-ms-1',
        materialId: 'mat-1',
        type: 'multiple_select',
        prompt: 'Select all prokaryotic organisms.',
        payload: {
            type: 'multiple_select',
            choices: ['Bacteria', 'Fungi', 'Archaea', 'Protists'],
            correctIndices: [0, 2],
        },
        points: 10,
        difficulty: 'medium',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('validate', () => {
        it('validates array of valid integer strings/numbers within choice bounds', () => {
            expect(strategy.validate(mockQuestion, ['0', '2'])).toBe(true);
            expect(strategy.validate(mockQuestion, ['1'])).toBe(true);
            expect(strategy.validate(mockQuestion, [])).toBe(true);
        });

        it('rejects non-array inputs', () => {
            expect(strategy.validate(mockQuestion, '0')).toBe(false);
            expect(strategy.validate(mockQuestion, true)).toBe(false);
            expect(strategy.validate(mockQuestion, null as unknown as string[])).toBe(false);
        });

        it('rejects arrays containing negative or out-of-bounds indices', () => {
            expect(strategy.validate(mockQuestion, ['-1', '0'])).toBe(false);
            expect(strategy.validate(mockQuestion, ['0', '4'])).toBe(false);
            expect(strategy.validate(mockQuestion, ['abc'])).toBe(false);
        });
    });

    describe('grade', () => {
        it('awards full points when exact correct indices are selected regardless of order', () => {
            const resultAsc = strategy.grade(mockQuestion, ['0', '2']);
            expect(resultAsc.isCorrect).toBe(true);
            expect(resultAsc.earnedPoints).toBe(10);

            const resultDesc = strategy.grade(mockQuestion, ['2', '0']);
            expect(resultDesc.isCorrect).toBe(true);
            expect(resultDesc.earnedPoints).toBe(10);
        });

        it('awards 0 points on partial selection', () => {
            const result = strategy.grade(mockQuestion, ['0']);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });

        it('awards 0 points when extra incorrect indices are included', () => {
            const result = strategy.grade(mockQuestion, ['0', '1', '2']);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });

        it('awards 0 points for completely wrong selections', () => {
            const result = strategy.grade(mockQuestion, ['1', '3']);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });
    });
});
