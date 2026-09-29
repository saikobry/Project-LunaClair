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

    /**
     * Two structural facts have no authoring rule, so the canvas used to accept
     * them: `validateQuestionPayload` — the single owner of the rule, the same
     * one the package validator and the Question Bank run — is what now refuses
     * them. The findings carry the owner's wording verbatim, because it is a
     * frozen contract mirrored byte-for-byte by the Worker, and re-wording it
     * here is how a second rule starts.
     */
    describe('Structural rules owned by validateQuestionPayload', () => {
        /**
         * `q.type` and `payload.type` are two statements about the same fact, and
         * `questionToCards` dispatches on the payload's while the canvas labels
         * the card by the declared one — so a card that disagrees studies in a
         * shape its type does not predict.
         */
        it('refuses a card whose payload.type disagrees with its declared type', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Nucleus', 'Mitochondria'],
                            correctIndex: 1,
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain(
                'payload.type "multiple_choice" does not match question type "identification".',
            );
        });

        it('refuses a non-array acceptedAlternatives', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'identification',
                            correctAnswer: 'Mitochondria',
                            acceptedAlternatives: 'Powerhouse of the cell' as unknown as string[],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain(
                'identification payload "acceptedAlternatives" must be an array of strings when provided.',
            );
        });

        it('refuses an acceptedAlternatives holding a non-string', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'identification',
                            correctAnswer: 'Mitochondria',
                            acceptedAlternatives: ['Powerhouse of the cell', 42 as unknown as string],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toContain(
                'identification payload "acceptedAlternatives" must be an array of strings when provided.',
            );
        });

        /**
         * The control: the owner is a gate, not a new obstacle. A well-formed card
         * that carries the optional field genuinely present is still valid, so the
         * save proceeds (`null` is what `SaveQuizUseCase` reads as "no errors").
         */
        it('accepts a well-formed card carrying a real acceptedAlternatives array', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'identification',
                        payload: {
                            type: 'identification',
                            correctAnswer: 'Mitochondria',
                            acceptedAlternatives: ['Powerhouse of the cell', 'Powerhouse'],
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)).toBeNull();
        });

        /**
         * The authoring rules keep their own voice on the fields they own: a card
         * the canvas already reports is not additionally judged by the owner, so
         * one defect is never reported twice in two vocabularies.
         */
        it('does not double-report a field the authoring rules already own', () => {
            const draft = createBaseDraft({
                items: [
                    createBaseItem({
                        type: 'multiple_choice',
                        payload: {
                            type: 'multiple_choice',
                            choices: ['Only one choice'],
                            correctIndex: 0,
                        },
                    }),
                ],
            });

            expect(validateQuizDraft(draft)?.items['card-1']).toEqual(['Add at least two choices.']);
        });
    });
});
