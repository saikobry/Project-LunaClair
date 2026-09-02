import { describe, expect, it } from 'vitest';
import { FillBlankStrategy } from '../FillBlankStrategy';
import type { Question } from '../../models/Question';

describe('FillBlankStrategy', () => {
    const strategy = new FillBlankStrategy();

    const mockQuestion: Question = {
        id: 'q-fb-1',
        materialId: 'mat-1',
        type: 'fill_in_blank',
        prompt: 'Fill in the metabolic components.',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ is the energy currency, produced by ___.',
            blanks: ['ATP', 'mitochondria'],
        },
        points: 8,
        difficulty: 'hard',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('validate', () => {
        it('validates array matching exact blank count with non-empty strings', () => {
            expect(strategy.validate(mockQuestion, ['ATP', 'mitochondria'])).toBe(true);
            expect(strategy.validate(mockQuestion, ['  atp  ', ' cells '])).toBe(true);
        });

        it('rejects arrays with incorrect length', () => {
            expect(strategy.validate(mockQuestion, ['ATP'])).toBe(false);
            expect(strategy.validate(mockQuestion, ['ATP', 'mitochondria', 'extra'])).toBe(false);
            expect(strategy.validate(mockQuestion, [])).toBe(false);
        });

        it('rejects empty or whitespace-only blanks within array', () => {
            expect(strategy.validate(mockQuestion, ['ATP', ''])).toBe(false);
            expect(strategy.validate(mockQuestion, ['ATP', '   '])).toBe(false);
        });

        it('rejects non-array input', () => {
            expect(strategy.validate(mockQuestion, 'ATP')).toBe(false);
            expect(strategy.validate(mockQuestion, true)).toBe(false);
            expect(strategy.validate(mockQuestion, null as unknown as string[])).toBe(false);
        });
    });

    describe('grade', () => {
        it('awards full points when all blanks match case-insensitively with trimmed whitespace', () => {
            const result = strategy.grade(mockQuestion, ['atp', '  MITOCHONDRIA  ']);
            expect(result.isCorrect).toBe(true);
            expect(result.earnedPoints).toBe(8);
        });

        it('awards 0 points if any single blank is incorrect', () => {
            const result = strategy.grade(mockQuestion, ['ATP', 'chloroplasts']);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });

        it('awards 0 points if blanks are in inverted order', () => {
            const result = strategy.grade(mockQuestion, ['mitochondria', 'ATP']);
            expect(result.isCorrect).toBe(false);
            expect(result.earnedPoints).toBe(0);
        });
    });
});
