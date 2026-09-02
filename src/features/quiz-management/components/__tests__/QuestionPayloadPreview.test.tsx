import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionPayloadPreview } from '../QuestionPayloadPreview';

describe('QuestionPayloadPreview', () => {
    it('renders multiple choice preview with correct indicator', () => {
        render(
            <QuestionPayloadPreview
                payload={{
                    type: 'multiple_choice',
                    choices: ['Alpha', 'Beta', 'Gamma'],
                    correctIndex: 1,
                }}
            />,
        );

        expect(screen.getByText('Choices')).toBeInTheDocument();
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders multiple select preview with multiple correct indicators', () => {
        render(
            <QuestionPayloadPreview
                payload={{
                    type: 'multiple_select',
                    choices: ['Choice 1', 'Choice 2', 'Choice 3'],
                    correctIndices: [0, 2],
                }}
            />,
        );

        expect(screen.getByText('Choice 1')).toBeInTheDocument();
        expect(screen.getByText('Choice 2')).toBeInTheDocument();
        expect(screen.getByText('Choice 3')).toBeInTheDocument();
        expect(screen.getAllByText('✓')).toHaveLength(2);
    });

    it('renders true/false preview', () => {
        const { rerender } = render(
            <QuestionPayloadPreview payload={{ type: 'true_false', correctAnswer: true }} />,
        );
        expect(screen.getByText('True')).toBeInTheDocument();

        rerender(<QuestionPayloadPreview payload={{ type: 'true_false', correctAnswer: false }} />);
        expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('renders identification preview with answer and alternatives', () => {
        render(
            <QuestionPayloadPreview
                payload={{
                    type: 'identification',
                    correctAnswer: 'Mitochondria',
                    acceptedAlternatives: ['Mitochondrion', 'Chondriosome'],
                }}
            />,
        );

        expect(screen.getByText('Mitochondria')).toBeInTheDocument();
        expect(screen.getByText(/Accepted alternatives: Mitochondrion, Chondriosome/)).toBeInTheDocument();
    });

    it('renders fill-in-the-blank preview with template and blanks', () => {
        render(
            <QuestionPayloadPreview
                payload={{
                    type: 'fill_in_blank',
                    template: 'DNA -> ___ -> ___.',
                    blanks: ['RNA', 'Protein'],
                }}
            />,
        );

        expect(screen.getByText('DNA -> ___ -> ___.')).toBeInTheDocument();
        expect(screen.getByText('1. RNA')).toBeInTheDocument();
        expect(screen.getByText('2. Protein')).toBeInTheDocument();
    });
});
