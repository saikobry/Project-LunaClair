import { describe, expect, it } from 'vitest';
import {
    validateQuestionDraft,
    validateQuestionsDraftArray,
    validateFlashcardsDraftArray,
} from '../questionDraftValidation';

describe('questionDraftValidation', () => {
    describe('validateQuestionDraft', () => {
        it('resolves correctIndex from the stated correctAnswer when no index is given', () => {
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
                expect(result.data.type).toBe('multiple_choice');
                expect(result.data.difficulty).toBe('medium');
                expect(result.data.points).toBe(1);
                expect(result.data.payload).toEqual({
                    type: 'multiple_choice',
                    choices: ['Nucleus', 'Mitochondria'],
                    correctIndex: 1,
                });
            }
        });

        it('rejects a multiple_choice with no determinable answer instead of defaulting to the first choice', () => {
            // Real llama output: `"correctIndex":` with the value dropped. Defaulting to 0 marked a
            // distractor correct, so the draft asserted a fact the model never supplied.
            const raw = {
                type: 'multiple_choice',
                prompt: 'What are the two main types of tissue that compose the skin?',
                payload: {
                    choices: ['Epidermis and Dermis', 'Connective Tissue and Epithelial Tissue'],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe('multiple_choice has no determinable correct answer');
            }
        });

        it('rejects a multiple_select with no determinable answers instead of defaulting to the first choice', () => {
            const raw = {
                type: 'multiple_select',
                prompt: 'Select prokaryotes.',
                payload: {
                    choices: ['Bacteria', 'Archaea', 'Yeast'],
                    correctIndices: [],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe('multiple_select has no determinable correct answers');
            }
        });

        it('keeps only in-range correctIndices for multiple_select', () => {
            const raw = {
                type: 'multiple_select',
                prompt: 'Select prokaryotes.',
                payload: {
                    choices: ['Bacteria', 'Archaea', 'Yeast'],
                    correctIndices: [0, 1, 7],
                },
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data.payload as { correctIndices: number[] }).correctIndices).toEqual([0, 1]);
            }
        });

        it('adopts the payload type when the top-level type lost a token (the `_false` slip)', () => {
            // Real llama output: top-level `true_false` arrived as `_false` while `payload.type` stayed
            // correct, so a structurally perfect question was discarded over one token.
            const raw = {
                type: '_false',
                prompt: 'Basal cell carcinoma is the most deadly type of skin cancer.',
                payload: { type: 'true_false', correctAnswer: false },
                difficulty: 'hard',
            };

            const result = validateQuestionDraft(raw);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('true_false');
                expect(result.data.payload).toEqual({ type: 'true_false', correctAnswer: false });
            }
        });

        it('still rejects an unusable type when the payload type is unusable too', () => {
            expect(
                validateQuestionDraft({
                    type: '_false',
                    prompt: 'Q',
                    payload: { type: '_false', correctAnswer: false },
                }).success,
            ).toBe(false);
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
        it('salvages valid questions and reports the rejected ones instead of failing the batch', () => {
            // The defect this replaced: one malformed item (e.g. a mistyped `true_false`) discarded
            // every valid sibling, so a request for 2 questions yielded none.
            const mixedArray = [
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
                {
                    type: '_false', // The real slip: `true_false` with the prefix lost
                    prompt: 'Invalid Question 3',
                    payload: { correctAnswer: false },
                },
            ];

            const result = validateQuestionsDraftArray(mixedArray);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.drafts).toHaveLength(1);
                expect(result.data.drafts[0].prompt).toBe('Valid Question 1');
                expect(result.data.rejected).toEqual([
                    { index: 1, error: 'multiple_choice requires at least 2 choices' },
                    { index: 2, error: 'Invalid question type: _false' },
                ]);
            }
        });

        it('fails only when nothing in the array survived validation', () => {
            const allInvalid = [
                { type: '_false', prompt: 'Bad', payload: { correctAnswer: false } },
            ];

            const result = validateQuestionsDraftArray(allInvalid);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('No usable questions');
                expect(result.error).toContain('Invalid question type: _false');
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
                expect(result.data.drafts).toHaveLength(1);
                expect(result.data.drafts[0].front).toBe('Mitochondria');
                expect(result.data.drafts[0].back).toBe('Powerhouse of the cell');
                expect(result.data.drafts[0].tags).toEqual(['bio', 'cells']);
                expect(result.data.rejected).toEqual([]);
            }
        });

        it('rejects cards with missing or whitespace-only front or back', () => {
            const invalidCards = [
                { front: 'Question', back: '   ' },
            ];

            const result = validateFlashcardsDraftArray(invalidCards);

            // Every card invalid means there is no review step to open — that is still a failure.
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('No usable flashcards');
                expect(result.error).toContain('card 1 — requires non-empty front and back text');
            }
        });
    });
});
