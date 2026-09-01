import { describe, expect, it } from 'vitest';
import { questionToCard } from '../questionToCard';
import type { Question } from '../../quiz/Question';

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

    it('converts multiple_choice question to flashcard with correct choice text on back', () => {
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
        expect(card.front).toBe('Which organelle makes ATP?');
        expect(card.back).toBe('Mitochondria');
        expect(card.explanation).toBe('Detailed concept explanation.');
        expect(card.materialId).toBe('mat-1');
    });

    it('converts multiple_select question to flashcard with joined correct choices on back', () => {
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

        expect(card.front).toBe('Select all prokaryotes.');
        expect(card.back).toBe('Bacteria, Archaea');
    });

    it('converts true_false question to flashcard with True or False on back', () => {
        const qTrue: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Water boils at 100C at sea level.',
            payload: { type: 'true_false', correctAnswer: true },
        };
        expect(questionToCard(qTrue).back).toBe('True');

        const qFalse: Question = {
            ...baseQuestion,
            type: 'true_false',
            prompt: 'Humans have 48 chromosomes.',
            payload: { type: 'true_false', correctAnswer: false },
        };
        expect(questionToCard(qFalse).back).toBe('False');
    });

    it('converts identification question with accepted alternatives on back', () => {
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

        expect(card.front).toBe('What is the capital of Japan?');
        expect(card.back).toBe('Tokyo (Also accepted: Edo, Toukyou)');
    });

    it('converts fill_in_blank question handling template and blank answers', () => {
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

        expect(card.front).toBe('The ___ is surrounded by the ___.');
        expect(card.back).toBe('nucleus, nuclear envelope');
    });
});
