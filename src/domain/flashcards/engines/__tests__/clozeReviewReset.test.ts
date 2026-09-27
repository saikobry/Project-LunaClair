import { describe, expect, it } from 'vitest';
import { affectedClozeBlankIndices } from '../clozeReviewReset';
import type { FillBlankPayload, QuestionAnswerPayload } from '../../../quiz/models/AnswerPayload';
import type { Question } from '../../../quiz/models/Question';

describe('affectedClozeBlankIndices', () => {
    const baseQuestion = {
        id: 'q-cloze-1',
        materialId: 'mat-1',
        points: 5,
        difficulty: 'medium' as const,
        version: 1,
        status: 'draft' as const,
        prompt: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const cloze = (payload: Partial<FillBlankPayload> = {}, overrides: Partial<Question> = {}): Question => ({
        ...baseQuestion,
        type: 'fill_in_blank',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
            blanks: ['Mitochondrion', 'cytoplasm'],
            ...payload,
        },
        ...overrides,
    });

    const nonCloze = (overrides: Partial<Question> = {}): Question => ({
        ...baseQuestion,
        type: 'multiple_choice',
        prompt: 'Which organelle makes ATP?',
        payload: {
            type: 'multiple_choice',
            choices: ['Nucleus', 'Mitochondrion'],
            correctIndex: 1,
        },
        ...overrides,
    });

    describe('resets every blank', () => {
        it('resets all indices when the resolved front changes through the template', () => {
            // A generic prompt contributes nothing to the front, so the template
            // *is* the front — and an edit to it is an edit to what the learner
            // reads. The policy never names `template`; it compares the front.
            const before = cloze({}, { prompt: 'Fill in the blank:' });
            const after = cloze({ template: 'The ___ generates ATP in the ___ of a eukaryotic cell.' }, { prompt: 'Fill in the blank:' });

            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1]);
        });

        it('resets all indices when a blank is added', () => {
            const after = cloze({
                template: 'The ___ produces ATP in the ___ of a eukaryotic cell, chiefly via ___ .',
                blanks: ['Mitochondrion', 'cytoplasm', 'oxidative phosphorylation'],
            });

            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([0, 1, 2]);
        });

        it('resets all indices — including the removed blanks’ keys — when a blank is dropped', () => {
            const before = cloze({
                template: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
                blanks: ['Mitochondrion', 'cytoplasm', 'matrix'],
            });
            const after = cloze({
                template: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
                blanks: ['Mitochondrion', 'cytoplasm'],
            });

            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1, 2]);
        });

        it('resets all indices when blanks are reordered', () => {
            const after = cloze({ blanks: ['cytoplasm', 'Mitochondrion'] });

            // A swap moves both facts, so both keys are stale even though the
            // set of answers is identical.
            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([0, 1]);
        });

        it('resets all indices when only the outer blanks of a three-blank question swap', () => {
            const before = cloze({
                template: 'The ___ produces ATP in the ___ of the eukaryotic ___ .',
                blanks: ['Mitochondrion', 'cytoplasm', 'cell'],
            });
            const after = cloze({
                template: 'The ___ produces ATP in the ___ of the eukaryotic ___ .',
                blanks: ['cell', 'cytoplasm', 'Mitochondrion'],
            });

            // Only #0 and #2 hold different text, but the schedule at #1 is part
            // of the same re-keyed cloze sequence, so the whole set is reset.
            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1, 2]);
        });
    });

    describe('resets only the edited blank', () => {
        it('resets a single index when one blank is edited in place', () => {
            const after = cloze({ blanks: ['Mitochondrion', 'mitochondrial matrix'] });

            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([1]);
        });

        it('resets a single index when the first of three blanks is edited in place', () => {
            const before = cloze({
                template: 'The ___ produces ATP in the ___ of the eukaryotic ___ .',
                blanks: ['Mitochondrion', 'cytoplasm', 'cell'],
            });
            const after = cloze({
                template: 'The ___ produces ATP in the ___ of the eukaryotic ___ .',
                blanks: ['Mitochondrion', 'cytoplasm', 'eukaryotic cell'],
            });

            expect(affectedClozeBlankIndices(before, after)).toEqual([2]);
        });
    });

    describe('ignores cosmetic differences', () => {
        it('treats a case-only change to a blank as no content change', () => {
            const after = cloze({ blanks: ['mitochondrion', 'cytoplasm'] });

            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([]);
        });

        it('treats a whitespace-only change to a blank as no content change', () => {
            const after = cloze({ blanks: ['  Mitochondrion ', 'cytoplasm'] });

            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([]);
        });

        it('treats a case-and-whitespace change to the front as no content change', () => {
            // A generic prompt leaves the template as the whole front, so this
            // is the normalisation of the compared text itself being exercised.
            const before = cloze({}, { prompt: 'Fill in the blank:' });
            const after = cloze(
                { template: '  the ___ produces ATP in the ___ of a EUKARYOTIC cell.  ' },
                { prompt: 'Fill in the blank:' }
            );

            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });

        it('returns nothing when the cloze content is byte-identical', () => {
            expect(affectedClozeBlankIndices(cloze(), cloze())).toEqual([]);
        });
    });

    describe('ignores everything that is not cloze content', () => {
        it('ignores a version bump alone — publishing must not wipe study history', () => {
            const before = cloze({}, { version: 3, status: 'draft' });
            const after = cloze({}, { version: 4, status: 'published' });

            expect(after.version).not.toBe(before.version);
            expect(after.status).not.toBe(before.status);
            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });

        it('ignores status, points, tags, explanation, and difficulty changes', () => {
            const before = cloze({}, { tags: ['bio'], explanation: 'Because.', difficulty: 'easy' });
            const after = cloze(
                {},
                {
                    status: 'archived',
                    points: 20,
                    tags: ['biology', 'atp'],
                    explanation: 'Because of the inner membrane.',
                    difficulty: 'hard',
                },
            );

            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });

        it('returns nothing for a non-cloze question whose own content changed', () => {
            const before = nonCloze();
            const after = nonCloze({
                payload: {
                    type: 'multiple_choice',
                    choices: ['Nucleus', 'Mitochondrion', 'Ribosome'],
                    correctIndex: 2,
                },
            } satisfies { payload: QuestionAnswerPayload });

            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });
    });

    describe('the reset follows the front the learner is actually tested on', () => {
        it('resets nothing when only the generic prompt is reworded', () => {
            // The generic prompt contributes nothing to the front, so the card is
            // byte-identical and the schedule the learner earned stands. Note the
            // generic set is whatever the shared resolver recognises — the literal
            // "fill in the blank" — so both prompts below resolve to the template.
            const before = cloze({}, { prompt: 'Fill in the blank:' });
            const after = cloze({}, { prompt: 'Please fill in the blank below:' });

            expect(after.prompt).not.toBe(before.prompt);
            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });

        it('resets all indices when a real, non-generic prompt is reworded', () => {
            const before = cloze({}, { prompt: 'Complete the sentence about ATP.' });
            const after = cloze({}, { prompt: 'Complete the sentence about cellular respiration.' });

            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1]);
        });

        it('resets all indices when a non-generic prompt is added to a question that had none', () => {
            const before = cloze({}, { prompt: '' });
            const after = cloze({}, { prompt: 'Name the two compartments involved.' });

            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1]);
        });

        it('resets nothing when the prompt holds the markers and the unused template is edited', () => {
            // The template is not rendered at all here, so a schedule cannot have
            // been earned on it — the front is genuinely unchanged.
            const before = cloze({ template: 'The original wording.' }, { prompt: 'The ___ and the ___ .' });
            const after = cloze({ template: 'A completely rewritten template.' }, { prompt: 'The ___ and the ___ .' });

            expect(affectedClozeBlankIndices(before, after)).toEqual([]);
        });
    });

    describe('the rule is asymmetric about cloze-ness', () => {
        it('retires every blank index when a cloze question is converted to another type', () => {
            // Nothing projects `q:<id>#0..#n` any more, so leaving them behind
            // would be permanent orphan debt with no card ever rendering it.
            const after = nonCloze({ id: 'q-cloze-1' });

            expect(affectedClozeBlankIndices(cloze(), after)).toEqual([0, 1]);
        });

        it('retires every blank index of a three-blank question that stops being cloze', () => {
            const before = cloze({
                template: 'The ___ produces ATP in the ___ of the eukaryotic ___ .',
                blanks: ['Mitochondrion', 'cytoplasm', 'matrix'],
            });
            const after = nonCloze({ id: 'q-cloze-1' });

            expect(affectedClozeBlankIndices(before, after)).toEqual([0, 1, 2]);
        });

        it('retires nothing when a non-cloze question becomes a cloze one', () => {
            // The per-blank keys are brand new and can hold no history; the
            // question's single `q:<id>` key is a separate concern this predicate
            // does not own.
            expect(affectedClozeBlankIndices(nonCloze({ id: 'q-cloze-1' }), cloze())).toEqual([]);
        });
    });
});
