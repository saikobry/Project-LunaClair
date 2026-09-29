import { describe, expect, it } from 'vitest';
import { FillBlankStrategy } from '../FillBlankStrategy';
import { validateStudyPackage } from '../../../package/engines/validateStudyPackage';
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

    /**
     * The retained guard. `blanks.length > 0` in both `validate` and `grade` is NOT a tolerance
     * for malformed content � every ingress validates � it is the narrower, permanent rule that
     * substituting an empty answer set must never become a vacuous match.
     *
     * A `fill_in_blank` question with no answers is a real authoring state the question is allowed
     * to be in, so the strategy must be reached with one. With zero answers, `every` over the
     * submission is vacuously true, so without the clause an EMPTY submission would score as
     * correct and take the question's points.
     *
     * Driven through the REAL validator to show the payload is not one any ingress can produce:
     * a cloze with no answers is refused, which is exactly why the strategy is never handed a
     * missing or non-array `blanks` and needs no `Array.isArray` guard for it.
     */
    describe('a cloze carrying no answers � never graded as a vacuous match', () => {
        const questionWithNoAnswers = (payload: unknown): Question =>
            ({ ...mockQuestion, payload }) as unknown as Question;

        it('refuses an empty submission, so no answers never means free points', () => {
            const question = questionWithNoAnswers({
                type: 'fill_in_blank',
                template: 'The ___ is the energy currency of the cell.',
                blanks: [],
            });

            expect(strategy.validate(question, [])).toBe(false);
            expect(strategy.grade(question, [])).toEqual({ isCorrect: false, earnedPoints: 0 });
        });

        it('refuses every non-empty submission too, because there is nothing to match', () => {
            const question = questionWithNoAnswers({
                type: 'fill_in_blank',
                template: 'The ___ is the energy currency of the cell.',
                blanks: [],
            });

            expect(strategy.validate(question, ['ATP'])).toBe(false);
            expect(strategy.grade(question, ['ATP'])).toEqual({ isCorrect: false, earnedPoints: 0 });
            expect(strategy.grade(question, ['chloroplasts'])).toEqual({ isCorrect: false, earnedPoints: 0 });
        });

        it('is not reachable from any ingress: the validator refuses a cloze with no answers', () => {
            // The reason the `Array.isArray` guard beside this clause could be deleted: the payload
            // this section exercises is one no write boundary admits.
            const { isValid, errors } = validateStudyPackage({
                format: 'lcpack',
                schemaVersion: 1,
                metadata: { title: 'Share', createdAt: '2026-08-27T00:00:00.000Z' },
                materials: [
                    {
                        id: 'pkg_mat_legacy',
                        title: 'Cell Biology',
                        documentContent: '# Cells',
                    },
                ],
                questions: [
                    {
                        id: 'pkg_q_cloze',
                        materialId: 'pkg_mat_legacy',
                        type: 'fill_in_blank',
                        prompt: 'Fill in the blank.',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'The ___ is the energy currency of the cell.',
                            blanks: [],
                        },
                        difficulty: 'medium',
                        points: 1,
                    },
                ],
                quizzes: [],
            });

            expect(isValid).toBe(false);
            expect(errors).toContain(
                'Question "pkg_q_cloze": fill_in_blank payload requires exactly one answer per "___" placeholder (1 in template, 0 supplied).',
            );
        });

        it('still grades a well-formed cloze normally, so the clause is not the gate', () => {
            const payload = {
                type: 'fill_in_blank',
                template: 'The ___ is the energy currency, produced by ___.',
                blanks: ['ATP', 'mitochondria'],
            };
            const question = { ...mockQuestion, payload } as Question;

            expect(strategy.validate(question, ['ATP', 'mitochondria'])).toBe(true);
            expect(strategy.grade(question, ['atp', '  MITOCHONDRIA '])).toEqual({
                isCorrect: true,
                earnedPoints: 8,
            });
        });
    });
});
