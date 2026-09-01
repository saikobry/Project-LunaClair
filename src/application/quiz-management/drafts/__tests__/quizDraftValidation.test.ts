import { describe, expect, it } from 'vitest';
import { validateQuizDraft } from '../quizDraftValidation';
import type { QuizDraft, QuestionDraft } from '../QuizDraft';

describe('quizDraftValidation', () => {
    const createBaseItem = (overrides?: Partial<QuestionDraft>): QuestionDraft => ({
        tempId: 'card-1',
        type: 'multiple_choice',
        prompt: 'Valid Question Prompt?',
        payload: {
            type: 'multiple_choice',
            choices: ['Option A', 'Option B'],
            correctIndex: 0,
        },
        points: 5,
        difficulty: 'medium',
        ...overrides,
    });

    const createBaseDraft = (overrides?: Partial<QuizDraft>): QuizDraft => ({
        draftId: 'draft-1',
        materialId: 'mat-1',
        title: 'Valid Quiz Title',
        passingPercentage: 70,
        items: [createBaseItem()],
        updatedAt: '2026-09-01T00:00:00.000Z',
        isDirty: false,
        ...overrides,
    });

    describe('Title and Item count validation', () => {
        it('returns error when title is empty or only whitespace', () => {
            const draft = createBaseDraft({ title: '   ' });
            const errors = validateQuizDraft(draft);

            expect(errors).not.toBeNull();
            expect(errors?.title).toBe('Quiz title is required.');
        });

        it('returns error when items array is empty', () => {
            const draft = createBaseDraft({ items: [] });
            const errors = validateQuizDraft(draft);

            expect(errors).not.toBeNull();
            expect(errors?.title).toBe('Add at least one question to the quiz.');
        });

        it('returns null when draft title and items are valid', () => {
            const draft = createBaseDraft();
            const errors = validateQuizDraft(draft);

            expect(errors).toBeNull();
        });
    });

    describe('General Question item validation', () => {
        it('flags empty or whitespace prompt', () => {
            const draft = createBaseDraft({
                items: [createBaseItem({ prompt: '  ' })],
            });
            const errors = validateQuizDraft(draft);

            expect(errors?.items['card-1']).toContain('Question prompt is required.');
        });

        it('flags points less than 1 or NaN', () => {
            const draftZero = createBaseDraft({
                items: [createBaseItem({ points: 0 })],
            });
            expect(validateQuizDraft(draftZero)?.items['card-1']).toContain('Points must be at least 1.');

            const draftNaN = createBaseDraft({
                items: [createBaseItem({ points: Number.NaN })],
            });
            expect(validateQuizDraft(draftNaN)?.items['card-1']).toContain('Points must be at least 1.');
        });
    });

    describe('Payload variant: multiple_choice', () => {
        it('requires at least two choices', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Only one choice'],
                            correctIndex: 0,
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Add at least two choices.');
        });

        it('requires all choices to have non-empty text', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Choice A', '   '],
                            correctIndex: 0,
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Every choice needs text.');
        });

        it('validates correctIndex boundaries', () => {
            const draftNegative = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Choice A', 'Choice B'],
                            correctIndex: -1,
                        },
                    }),
                ],
            });
            expect(validateQuizDraft(draftNegative)?.items['card-1']).toContain('Select the correct answer.');

            const draftOutOfRange = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Choice A', 'Choice B'],
                            correctIndex: 2,
                        },
                    }),
                ],
            });
            expect(validateQuizDraft(draftOutOfRange)?.items['card-1']).toContain('Select the correct answer.');
        });
    });

    describe('Payload variant: multiple_select', () => {
        it('requires at least two choices and non-blank choices', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_select',
                            choices: ['Choice A', ''],
                            correctIndices: [0],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Every choice needs text.');
        });

        it('requires at least one marked correct choice', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_select',
                            choices: ['Choice A', 'Choice B'],
                            correctIndices: [],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Mark at least one choice as correct.');
        });

        it('flags out-of-range correct indices', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        payload: {
                            type: 'multiple_select',
                            choices: ['Choice A', 'Choice B'],
                            correctIndices: [0, 5],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain(
                'One of the correct answers is no longer a valid choice.',
            );
        });
    });

    describe('Payload variant: true_false', () => {
        it('is always valid when prompt and points are valid', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'true_false',
                        payload: {
                            type: 'true_false',
                            correctAnswer: true,
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)).toBeNull();
        });
    });

    describe('Payload variant: identification', () => {
        it('requires non-empty correctAnswer', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'identification',
                            correctAnswer: '   ',
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Enter the correct answer.');
        });

        it('passes with valid correctAnswer', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'identification',
                            correctAnswer: 'Mitochondria',
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)).toBeNull();
        });
    });

    describe('Payload variant: fill_in_blank', () => {
        it('requires at least one triple underscore ___ in template', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'fill_in_blank',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'There are no blanks here.',
                            blanks: ['answer'],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain(
                'Use ___ (three underscores) to mark at least one blank.',
            );
        });

        it('requires blanks array length to match blank count in template', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'fill_in_blank',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'The ___ is the powerhouse of the ___.',
                            blanks: ['mitochondria'], // expected 2 blanks, provided 1
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Every blank needs an answer.');
        });

        it('requires every blank answer to be non-empty', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'fill_in_blank',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'The ___ is the powerhouse of the ___.',
                            blanks: ['mitochondria', '  '],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain('Every blank needs an answer.');
        });

        it('passes with matching template and non-empty blanks', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'fill_in_blank',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'The ___ is the powerhouse of the ___.',
                            blanks: ['mitochondria', 'cell'],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)).toBeNull();
        });
    });
});
