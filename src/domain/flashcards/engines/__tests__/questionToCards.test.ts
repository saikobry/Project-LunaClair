import { assert, describe, expect, it } from 'vitest';
import { questionToCards } from '../questionToCards';
import type { Question } from '../../../quiz/models/Question';

describe('questionToCards', () => {
    const baseQuestion = {
        id: 'q-test-1',
        materialId: 'mat-1',
        points: 5,
        difficulty: 'medium' as const,
        version: 1,
        status: 'published' as const,
        explanation: 'Detailed concept explanation.',
        tags: ['bio', 'cells'],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const fillBlank = (payload: {
        template: string;
        blanks: string[];
    }, prompt = 'Fill in the blank:'): Question => ({
        ...baseQuestion,
        type: 'fill_in_blank',
        prompt,
        payload: { type: 'fill_in_blank', ...payload },
    });

    it('converts multiple_choice question to exactly one choice card with the options and their correctness', () => {
        const q: Question = {
            ...baseQuestion,
            type: 'multiple_choice',
            prompt: 'Which organelle makes ATP?',
            payload: {
                type: 'multiple_choice',
                choices: ['Nucleus', 'Mitochondria', 'Ribosome'],
                correctIndex: 1,
            },
        };

        const cards = questionToCards(q);

        expect(cards).toHaveLength(1);
        const card = cards[0];
        expect(card.key).toBe('q:q-test-1');
        expect(card.kind).toBe('choice');
        expect(card.front).toBe('Which organelle makes ATP?');
        expect(card.back).toBe('Mitochondria');
        expect(card.explanation).toBe('Detailed concept explanation.');
        expect(card.materialId).toBe('mat-1');

        // The options are part of the question, so they travel with the card
        // and exactly one carries the correct flag.
        assert(card.kind === 'choice');
        expect(card.choices).toEqual([
            { label: 'Nucleus', correct: false },
            { label: 'Mitochondria', correct: true },
            { label: 'Ribosome', correct: false },
        ]);
    });

    it('converts multiple_select question to exactly one choice card that marks every correct option', () => {
        const q: Question = {
            ...baseQuestion,
            type: 'multiple_select',
            prompt: 'Select all prokaryotes.',
            payload: {
                type: 'multiple_select',
                choices: ['Bacteria', 'Fungi', 'Archaea'],
                correctIndices: [0, 2],
            },
        };

        const cards = questionToCards(q);

        expect(cards).toHaveLength(1);
        const card = cards[0];
        expect(card.key).toBe('q:q-test-1');
        expect(card.kind).toBe('choice');
        expect(card.front).toBe('Select all prokaryotes.');
        expect(card.back).toBe('Bacteria, Archaea');

        assert(card.kind === 'choice');
        expect(card.choices).toEqual([
            { label: 'Bacteria', correct: true },
            { label: 'Fungi', correct: false },
            { label: 'Archaea', correct: true },
        ]);
        // A per-choice boolean is required: multiple_select has more than one
        // correct option, so a single `correctIndex` could not express this.
        expect(card.choices.filter((c) => c.correct)).toHaveLength(2);
    });

    it('converts true_false question to exactly one recall card with True or False on back', () => {
        const qTrue: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Water boils at 100C at sea level.',
            payload: { type: 'true_false', correctAnswer: true },
        };
        const trueCards = questionToCards(qTrue);
        expect(trueCards).toHaveLength(1);
        expect(trueCards[0].kind).toBe('recall');
        expect(trueCards[0].back).toBe('True');
        expect(trueCards[0].front).toBe('Water boils at 100C at sea level.');

        const qFalse: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Humans have 48 chromosomes.',
            payload: { type: 'true_false', correctAnswer: false },
        };
        const falseCards = questionToCards(qFalse);
        expect(falseCards).toHaveLength(1);
        expect(falseCards[0].kind).toBe('recall');
        expect(falseCards[0].back).toBe('False');
        expect(falseCards[0].front).toBe('Humans have 48 chromosomes.');
    });

    it('converts identification question to exactly one recall card with accepted alternatives on back', () => {
        const q: Question = {
            ...baseQuestion,
            type: 'identification',
            prompt: 'What is the capital of Japan?',
            payload: {
                type: 'identification',
                correctAnswer: 'Tokyo',
                acceptedAlternatives: ['Edo', 'Toukyou'],
            },
        };

        const cards = questionToCards(q);

        expect(cards).toHaveLength(1);
        const card = cards[0];
        expect(card.kind).toBe('recall');
        expect(card.front).toBe('What is the capital of Japan?');
        expect(card.back).toBe('Tokyo (Also accepted: Edo, Toukyou)');
    });

    it('keeps the whole-question `q:` key for every non-cloze type', () => {
        // Review state is persisted under these keys, so a non-cloze card must
        // keep the byte-identical legacy key. Asserted literally, never built
        // with the helper under test.
        const nonCloze: Question[] = [
            {
                ...baseQuestion,
                type: 'multiple_choice',
                prompt: 'MC',
                payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
            },
            {
                ...baseQuestion,
                type: 'multiple_select',
                prompt: 'MS',
                payload: { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [0] },
            },
            { ...baseQuestion, type: 'true_false', prompt: 'TF', payload: { type: 'true_false', correctAnswer: true } },
            {
                ...baseQuestion,
                type: 'identification',
                prompt: 'ID',
                payload: { type: 'identification', correctAnswer: 'A' },
            },
        ];

        for (const q of nonCloze) {
            const cards = questionToCards(q);
            expect(cards).toHaveLength(1);
            expect(cards[0].key).toBe('q:q-test-1');
        }
    });

    describe('fill_in_blank — one card per blank', () => {
        it('yields one card for a single-blank question, keyed `#0`', () => {
            const cards = questionToCards(
                fillBlank({ template: 'The ___ stores DNA.', blanks: ['nucleus'] })
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].key).toBe('q:q-test-1#0');
            expect(cards[0].kind).toBe('recall');
            // A single blank is still a cloze card, and it is byte-identical to
            // the legacy single-card front.
            expect(cards[0].front).toBe('The ___ stores DNA.');
            expect(cards[0].back).toBe('nucleus');
        });

        it('yields one card per blank for a 3-blank question, keyed `#0 #1 #2`', () => {
            const cards = questionToCards(
                fillBlank({
                    template: 'The ___ contains the ___ and the ___.',
                    blanks: ['nucleus', 'chromatin', 'DNA'],
                })
            );

            expect(cards.map((c) => c.key)).toEqual([
                'q:q-test-1#0',
                'q:q-test-1#1',
                'q:q-test-1#2',
            ]);
        });

        it('gives each card the others’ answers as scaffolding and hides only its own blank', () => {
            const cards = questionToCards(
                fillBlank({
                    template: 'The ___ contains the ___ and the ___.',
                    blanks: ['nucleus', 'chromatin', 'DNA'],
                })
            );

            expect(cards.map((c) => c.front)).toEqual([
                'The ___ contains the chromatin and the DNA.',
                'The nucleus contains the ___ and the DNA.',
                'The nucleus contains the chromatin and the ___.',
            ]);

            // Each front hides exactly one marker and reveals exactly one
            // answer per *other* blank — never its own.
            for (const card of cards) {
                expect(card.front.match(/___/g)).toHaveLength(1);
            }
        });

        it('puts only the tested blank on the back, never the whole sentence', () => {
            const cards = questionToCards(
                fillBlank({
                    template: 'The ___ contains the ___ and the ___.',
                    blanks: ['nucleus', 'chromatin', 'DNA'],
                })
            );

            expect(cards.map((c) => c.back)).toEqual(['nucleus', 'chromatin', 'DNA']);
        });

        it('carries the shared projection fields onto every expanded card', () => {
            const cards = questionToCards(
                fillBlank({
                    template: 'The ___ contains the ___ and the ___.',
                    blanks: ['nucleus', 'chromatin', 'DNA'],
                })
            );

            for (const card of cards) {
                expect(card.source).toEqual({ type: 'question', questionId: 'q-test-1' });
                expect(card.materialId).toBe('mat-1');
                expect(card.tags).toEqual(['bio', 'cells']);
                expect(card.difficulty).toBe('medium');
                expect(card.explanation).toBe('Detailed concept explanation.');
            }
        });

        it('expands the legacy prompt-to-template fallback per blank, not once', () => {
            // A prompt that carries real prose (no `___` marker) is prefixed
            // with the template; legacy stored rows still depend on this. The
            // fallback runs BEFORE expansion, so the expansion operates on the
            // resolved `prompt\n\ntemplate` front.
            const cards = questionToCards(
                fillBlank(
                    { template: 'The ___ stores DNA.', blanks: ['nucleus'] },
                    'Complete the sentence about the nucleus.'
                )
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].front).toBe(
                'Complete the sentence about the nucleus.\n\nThe ___ stores DNA.'
            );
            expect(cards[0].back).toBe('nucleus');
        });

        it('uses the prompt as the cloze front when the prompt itself holds the markers', () => {
            const cards = questionToCards(
                fillBlank(
                    { template: 'Ignored by the projection.', blanks: ['alpha', 'beta'] },
                    'The ___ and the ___.'
                )
            );

            expect(cards).toHaveLength(2);
            expect(cards[0].front).toBe('The ___ and the beta.');
            expect(cards[1].front).toBe('The alpha and the ___.');
        });
    });

    describe('fill_in_blank — no per-blank expansion available', () => {
        it('falls back to one legacy card (not zero) when the row carries no answers', () => {
            // A question that vanishes from the deck is silent data loss; a
            // single card with the template on the back is the honest minimum.
            const cards = questionToCards(
                fillBlank({ template: 'The nucleus stores DNA.', blanks: [] })
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].kind).toBe('recall');
            expect(cards[0].key).toBe('q:q-test-1');
            expect(cards[0].front).toBe('The nucleus stores DNA.');
            expect(cards[0].back).toBe('The nucleus stores DNA.');
        });

        it('keeps the joined-answers back when the marker count disagrees with the answers', () => {
            // Two answers, one marker: no card can hide the second answer, so
            // guessing a pairing would print it on the card's own front.
            const cards = questionToCards(
                fillBlank({ template: 'The ___ stores DNA.', blanks: ['nucleus', 'DNA'] })
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].key).toBe('q:q-test-1');
            expect(cards[0].front).toBe('The ___ stores DNA.');
            expect(cards[0].back).toBe('nucleus, DNA');
        });

        it('keeps the joined-answers back when the front has no marker at all', () => {
            const cards = questionToCards(
                fillBlank({ template: 'The nucleus stores DNA.', blanks: ['nucleus'] })
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].key).toBe('q:q-test-1');
            expect(cards[0].back).toBe('nucleus');
        });
    });

    /**
     * The projection reads its cloze front from `resolveClozeCardFront`, the
     * same function the cloze schedule-invalidation policy compares. A second
     * implementation of that resolution is the one thing that could make the
     * reset policy stop matching what is rendered, so each resolution branch is
     * pinned here with a **literal** expected front — never rebuilt with the
     * function under test.
     */
    describe('cloze front resolution — byte-identical per branch', () => {
        const branches: Array<{ label: string; prompt: string; template: string; front: string }> = [
            {
                label: 'generic prompt resolves to the bare template',
                prompt: 'Fill in the blank:',
                template: 'The ___ stores DNA.',
                front: 'The ___ stores DNA.',
            },
            {
                label: 'whitespace-only prompt resolves to the bare template',
                prompt: '  ',
                template: 'The ___ stores DNA.',
                front: 'The ___ stores DNA.',
            },
            {
                label: 'marker-free prompt is prefixed above the template',
                prompt: 'Complete the sentence about the nucleus.',
                template: 'The ___ stores DNA.',
                front: 'Complete the sentence about the nucleus.\n\nThe ___ stores DNA.',
            },
            {
                label: 'marker-bearing prompt wins and the template is not read',
                prompt: 'The ___ stores the ___.',
                template: 'Ignored by the projection.',
                front: 'The ___ stores the ___.',
            },
            {
                label: 'prompt equal to the template is returned unchanged',
                prompt: 'The ___ stores DNA.',
                template: 'The ___ stores DNA.',
                front: 'The ___ stores DNA.',
            },
        ];

        for (const { label, prompt, template, front } of branches) {
            it(label, () => {
                // A single blank is its own target, so the expanded front is the
                // resolved front with that one marker left as `___`.
                const cards = questionToCards(fillBlank({ template, blanks: ['nucleus'] }, prompt));

                expect(cards).toHaveLength(1);
                expect(cards[0].front).toBe(front);
            });
        }
    });

    it('carries the shared projection fields on both card kinds', () => {
        const recall = questionToCards({
            ...baseQuestion,
            type: 'true_false',
            prompt: 'TF',
            payload: { type: 'true_false', correctAnswer: true },
        });
        const choice = questionToCards({
            ...baseQuestion,
            type: 'multiple_choice',
            prompt: 'MC',
            payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        });

        for (const card of [...recall, ...choice]) {
            expect(card.key).toBe('q:q-test-1');
            expect(card.source).toEqual({ type: 'question', questionId: 'q-test-1' });
            expect(card.materialId).toBe('mat-1');
            expect(card.tags).toEqual(['bio', 'cells']);
            expect(card.difficulty).toBe('medium');
            expect(card.explanation).toBe('Detailed concept explanation.');
        }
    });
});
