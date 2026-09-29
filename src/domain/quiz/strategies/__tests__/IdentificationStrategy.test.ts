import { describe, expect, it } from 'vitest';
import { IdentificationStrategy } from '../IdentificationStrategy';
import { validateStudyPackage } from '../../../package/engines/validateStudyPackage';
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

    /**
     * `acceptedAlternatives` is optional, so its ABSENT case is the ordinary one and `?? []` is the
     * whole of what the strategy needs. A non-array is not: the package read tier used to admit
     * one, and `.map` on a string is a `TypeError` on exactly that row. Every ingress now
     * validates, so the guard that absorbed it has been deleted � this suite pins that a payload
     * declaring no alternatives at all still grades, which is the case that must not regress.
     */
    describe('a payload that declares no alternatives', () => {
        it('grades on correctAnswer alone, and is not reachable with a non-array', () => {
            const payload = { type: 'identification', correctAnswer: 'Paris' };
            const question = { ...mockQuestion, payload } as Question;

            expect(strategy.validate(question, 'Paris')).toBe(true);
            expect(strategy.grade(question, 'paris')).toEqual({ isCorrect: true, earnedPoints: 6 });
            expect(strategy.grade(question, 'London')).toEqual({ isCorrect: false, earnedPoints: 0 });

            // The reason the `Array.isArray` guard could be deleted.
            const { isValid, errors } = validateStudyPackage({
                format: 'lcpack',
                schemaVersion: 1,
                metadata: { title: 'Share', createdAt: '2026-08-27T00:00:00.000Z' },
                materials: [
                    {
                        id: 'pkg_mat_legacy',
                        title: 'World Capitals',
                        documentContent: '# Capitals',
                    },
                ],
                questions: [
                    {
                        id: 'pkg_q_ident',
                        materialId: 'pkg_mat_legacy',
                        type: 'identification',
                        prompt: 'What is the capital of Japan?',
                        payload: { type: 'identification', correctAnswer: 'Tokyo', acceptedAlternatives: 'Edo' },
                        difficulty: 'medium',
                        points: 1,
                    },
                ],
                quizzes: [],
            });

            expect(isValid).toBe(false);
            expect(errors).toContain(
                'Question "pkg_q_ident": identification payload "acceptedAlternatives" must be an array of strings when provided.',
            );
        });

        it('still grades a well-formed payload that supplies real alternatives', () => {
            const payload = {
                type: 'identification',
                correctAnswer: 'Paris',
                acceptedAlternatives: ['City of Light', 'Ville Lumiere'],
            };
            const question = { ...mockQuestion, payload } as Question;

            expect(strategy.grade(question, 'Paris')).toEqual({ isCorrect: true, earnedPoints: 6 });
            expect(strategy.grade(question, '  ville lumiere  ')).toEqual({
                isCorrect: true,
                earnedPoints: 6,
            });
            expect(strategy.grade(question, 'London')).toEqual({ isCorrect: false, earnedPoints: 0 });
        });
    });
});
