import { assert, describe, expect, it } from 'vitest';
import { questionToCard } from '../questionToCard';
import type { Question } from '../../../quiz/models/Question';

describe('questionToCard', () => {
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

    it('converts multiple_choice question to a choice card with the options and their correctness', () => {
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

        const card = questionToCard(q);

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

    it('converts multiple_select question to a choice card that marks every correct option', () => {
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

        const card = questionToCard(q);

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

    it('converts true_false question to a recall card with True or False on back', () => {
        const qTrue: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Water boils at 100C at sea level.',
            payload: { type: 'true_false', correctAnswer: true },
        };
        const trueCard = questionToCard(qTrue);
        expect(trueCard.kind).toBe('recall');
        expect(trueCard.back).toBe('True');
        expect(trueCard.front).toBe('Water boils at 100C at sea level.');

        const qFalse: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Humans have 48 chromosomes.',
            payload: { type: 'true_false', correctAnswer: false },
        };
        const falseCard = questionToCard(qFalse);
        expect(falseCard.kind).toBe('recall');
        expect(falseCard.back).toBe('False');
        expect(falseCard.front).toBe('Humans have 48 chromosomes.');
    });

    it('converts identification question to a recall card with accepted alternatives on back', () => {
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

        const card = questionToCard(q);

        expect(card.kind).toBe('recall');
        expect(card.front).toBe('What is the capital of Japan?');
        expect(card.back).toBe('Tokyo (Also accepted: Edo, Toukyou)');
    });

    it('converts fill_in_blank question to a recall card handling template and blank answers', () => {
        const q: Question = {
            ...baseQuestion,
            type: 'fill_in_blank',
            prompt: 'Fill in the blank:',
            payload: {
                type: 'fill_in_blank',
                template: 'The ___ is surrounded by the ___.',
                blanks: ['nucleus', 'nuclear envelope'],
            },
        };

        const card = questionToCard(q);

        expect(card.kind).toBe('recall');
        expect(card.front).toBe('The ___ is surrounded by the ___.');
        expect(card.back).toBe('nucleus, nuclear envelope');
    });

    it('carries the shared projection fields on both card kinds', () => {
        const recall = questionToCard({
            ...baseQuestion,
            type: 'true_false',
            prompt: 'TF',
            payload: { type: 'true_false', correctAnswer: true },
        });
        const choice = questionToCard({
            ...baseQuestion,
            type: 'multiple_choice',
            prompt: 'MC',
            payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        });

        for (const card of [recall, choice]) {
            expect(card.key).toBe('q:q-test-1');
            expect(card.source).toEqual({ type: 'question', questionId: 'q-test-1' });
            expect(card.materialId).toBe('mat-1');
            expect(card.tags).toEqual(['bio', 'cells']);
            expect(card.difficulty).toBe('medium');
            expect(card.explanation).toBe('Detailed concept explanation.');
        }
    });

    it('keeps the legacy prompt-to-template fallback for stored fill_in_blank rows', () => {
        // A prompt that carries real prose (no `___` marker) is prefixed with
        // the template; legacy stored rows still depend on this.
        const q: Question = {
            ...baseQuestion,
            type: 'fill_in_blank',
            prompt: 'Complete the sentence about the nucleus.',
            payload: {
                type: 'fill_in_blank',
                template: 'The nucleus stores DNA.',
                blanks: ['nucleus'],
            },
        };

        const card = questionToCard(q);

        expect(card.kind).toBe('recall');
        expect(card.front).toBe('Complete the sentence about the nucleus.\n\nThe nucleus stores DNA.');
    });
});
