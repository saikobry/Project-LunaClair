import { describe, expect, it } from 'vitest';
import { IdentificationStrategy } from '../IdentificationStrategy';
import type { Question } from '../../models/Question';

describe('IdentificationStrategy', () => {
    const strategy = new IdentificationStrategy();

    const mockQuestion: Question = {
        id: 'q-id-1',
        materialId: 'mat-1',
        type: 'identification',
        prompt: 'What is the capital of France?',
        payload: {
            type: 'identification',
            correctAnswer: 'Paris',
            acceptedAlternatives: ['City of Light', 'Ville Lumiere'],
        },
        points: 6,
        difficulty: 'medium',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    describe('validate', () => {
        it('validates non-empty strings', () => {
            expect(strategy.validate(mockQuestion, 'Paris')).toBe(true);
            expect(strategy.validate(mockQuestion, '  paris  ')).toBe(true);
        });

        it('rejects empty or whitespace-only strings', () => {
            expect(strategy.validate(mockQuestion, '')).toBe(false);
            expect(strategy.validate(mockQuestion, '   ')).toBe(false);
        });

        it('rejects non-string types', () => {
            expect(strategy.validate(mockQuestion, 123 as unknown as string)).toBe(false);
            expect(strategy.validate(mockQuestion, ['Paris'])).toBe(false);
            expect(strategy.validate(mockQuestion, true)).toBe(false);
        });
    });

    describe('grade', () => {
        it('grades case-insensitively and ignores outer whitespace for primary answer', () => {
            expect(strategy.grade(mockQuestion, 'Paris').isCorrect).toBe(true);
            expect(strategy.grade(mockQuestion, 'paris').isCorrect).toBe(true);
            expect(strategy.grade(mockQuestion, '  PARIS  ').isCorrect).toBe(true);
            expect(strategy.grade(mockQuestion, 'Paris').earnedPoints).toBe(6);
        });

        it('grades accepted alternatives correctly', () => {
            const altResult = strategy.grade(mockQuestion, 'City of Light');
            expect(altResult.isCorrect).toBe(true);
            expect(altResult.earnedPoints).toBe(6);

            const altLower = strategy.grade(mockQuestion, '  ville lumiere  ');
            expect(altLower.isCorrect).toBe(true);
            expect(altLower.earnedPoints).toBe(6);
        });

        it('awards 0 points on wrong answer', () => {
            const wrongResult = strategy.grade(mockQuestion, 'London');
            expect(wrongResult.isCorrect).toBe(false);
            expect(wrongResult.earnedPoints).toBe(0);
        });
    });
});
