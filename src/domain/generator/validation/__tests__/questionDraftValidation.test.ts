import { describe, expect, it } from 'vitest';
import {
    validateQuestionDraft,
    validateQuestionsDraftArray,
    validateFlashcardsDraftArray,
} from '../questionDraftValidation';

describe('questionDraftValidation', () => {
    describe('validateQuestionDraft', () => {
        it('validates multiple_choice and applies defaults (difficulty medium, points 1, correctIndex 0)', () => {
            const raw = {
                type: 'multiple_choice',
                prompt: 'What organelle produces ATP?',
                payload: {
                    choices: ['Mitochondria', 'Nucleus'],
                    // correctIndex omitted
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('multiple_choice');
                expect(result.data.difficulty).toBe('medium');
                expect(result.data.points).toBe(1);
                expect(result.data.payload).toEqual({
                    type: 'multiple_choice',
                    choices: ['Mitochondria', 'Nucleus'],
                    correctIndex: 0,
                });
            }
        });

        it('resolves correctIndex from correctAnswer string if correctIndex is missing', () => {
            const raw = {
                type: 'multiple_choice',
                prompt: 'What organelle produces ATP?',
                payload: {
                    choices: ['Nucleus', 'Mitochondria'],
                    correctAnswer: 'Mitochondria',
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data.payload as { correctIndex: number }).correctIndex).toBe(1);
            }
        });

        it('validates multiple_select and defaults correctIndices to [0] if empty', () => {
            const raw = {
                type: 'multiple_select',
                prompt: 'Select prokaryotes.',
                payload: {
                    choices: ['Bacteria', 'Archaea', 'Yeast'],
                    correctIndices: [],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data.payload as { correctIndices: number[] }).correctIndices).toEqual([0]);
            }
        });

        it('validates true_false questions with boolean correctAnswer', () => {
            const raw = {
                type: 'true_false',
                prompt: 'Water boils at 100C.',
                payload: { correctAnswer: true },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payload).toEqual({
                    type: 'true_false',
                    correctAnswer: true,
                });
            }
        });

        it('validates identification questions and trims acceptedAlternatives', () => {
            const raw = {
                type: 'identification',
                prompt: 'Capital of France?',
                payload: {
                    correctAnswer: '  Paris  ',
                    acceptedAlternatives: ['  City of Light ', ''],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payload).toEqual({
                    type: 'identification',
                    correctAnswer: 'Paris',
                    acceptedAlternatives: ['City of Light'],
                });
            }
        });

        it('validates fill_in_blank questions with template and blanks', () => {
            const raw = {
                type: 'fill_in_blank',
                prompt: 'Metabolism',
                payload: {
                    template: 'The ___ produces ___.',
                    blanks: ['mitochondria', 'ATP'],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payload).toEqual({
                    type: 'fill_in_blank',
                    template: 'The ___ produces ___.',
                    blanks: ['mitochondria', 'ATP'],
                });
            }
        });

        it('flags invalid input: non-object, empty prompt, or unsupported question type', () => {
            expect(validateQuestionDraft(null).success).toBe(false);
            expect(validateQuestionDraft({ prompt: '   ', type: 'multiple_choice' }).success).toBe(false);
            expect(validateQuestionDraft({ prompt: 'Valid', type: 'essay' }).success).toBe(false);
        });

        it('flags invalid payloads: MCQ with < 2 choices, identification missing answer, fill_in_blank missing blanks', () => {
            expect(
                validateQuestionDraft({
                    type: 'multiple_choice',
                    prompt: 'Q',
                    payload: { choices: ['Only one'] },
                }).success,
            ).toBe(false);

            expect(
                validateQuestionDraft({
                    type: 'identification',
                    prompt: 'Q',
                    payload: { correctAnswer: '   ' },
                }).success,
            ).toBe(false);

            expect(
                validateQuestionDraft({
                    type: 'fill_in_blank',
                    prompt: 'Q',
                    payload: { template: 'Text', blanks: [] },
                }).success,
            ).toBe(false);
        });
    });

    describe('validateQuestionsDraftArray', () => {
        it('validates array of questions and reports 1-indexed failure details', () => {
            const invalidArray = [
                {
                    type: 'true_false',
                    prompt: 'Valid Question 1',
                    payload: { correctAnswer: true },
                },
                {
                    type: 'multiple_choice',
                    prompt: 'Invalid Question 2',
                    payload: { choices: [] }, // Invalid
                },
            ];

            const result = validateQuestionsDraftArray(invalidArray);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('Item 2 is invalid:');
            }
        });

        it('rejects empty arrays or non-array inputs', () => {
            expect(validateQuestionsDraftArray([]).success).toBe(false);
            expect(validateQuestionsDraftArray('not an array').success).toBe(false);
        });
    });

    describe('validateFlashcardsDraftArray', () => {
        it('validates flashcard drafts and ensures non-empty front and back', () => {
            const rawCards = [
                {
                    front: '  Mitochondria  ',
                    back: '  Powerhouse of the cell  ',
                    tags: ['bio', 'cells'],
                },
            ];

            const result = validateFlashcardsDraftArray(rawCards);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].front).toBe('Mitochondria');
                expect(result.data[0].back).toBe('Powerhouse of the cell');
                expect(result.data[0].tags).toEqual(['bio', 'cells']);
            }
        });

        it('rejects cards with missing or whitespace-only front or back', () => {
            const invalidCards = [
                { front: 'Question', back: '   ' },
            ];

            const result = validateFlashcardsDraftArray(invalidCards);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('Card 1 requires non-empty front and back text');
            }
        });
    });
});
