import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionRenderer } from '../QuestionRenderer';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('QuestionRenderer & Question Types', () => {
    it('renders MultipleChoiceQuestion and emits selected index as string on click', () => {
        const mcQuestion: Question = {
            id: 'q-mc',
            materialId: 'mat-1',
            type: 'multiple_choice',
            prompt: 'Which organelle produces ATP?',
            payload: { type: 'multiple_choice', choices: ['Mitochondria', 'Ribosome', 'Golgi apparatus'], correctIndex: 0 },
            difficulty: 'easy',
            points: 1,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        const onChange = vi.fn();
        render(<QuestionRenderer question={mcQuestion} value="" onChange={onChange} />);

        expect(screen.getByText('Which organelle produces ATP?')).toBeInTheDocument();
        const option = screen.getByLabelText('Mitochondria');
        fireEvent.click(option);

        expect(onChange).toHaveBeenCalledWith('0');
    });

    it('renders MultipleSelectQuestion and toggles multiple choices array', () => {
        const msQuestion: Question = {
            id: 'q-ms',
            materialId: 'mat-1',
            type: 'multiple_select',
            prompt: 'Select all mammals:',
            payload: { type: 'multiple_select', choices: ['Dolphin', 'Eagle', 'Whale', 'Lizard'], correctIndices: [0, 2] },
            difficulty: 'medium',
            points: 2,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        const onChange = vi.fn();
        const { rerender } = render(
            <QuestionRenderer question={msQuestion} value={['0']} onChange={onChange} />,
        );

        // Click Whale (index 2) -> adds '2' to ['0']
        const whaleCheckbox = screen.getByLabelText('Whale');
        fireEvent.click(whaleCheckbox);
        expect(onChange).toHaveBeenCalledWith(['0', '2']);

        // Rerender with both selected, then click Dolphin (index 0) to uncheck
        rerender(<QuestionRenderer question={msQuestion} value={['0', '2']} onChange={onChange} />);
        const dolphinCheckbox = screen.getByLabelText('Dolphin');
        fireEvent.click(dolphinCheckbox);
        expect(onChange).toHaveBeenCalledWith(['2']);
    });

    it('renders TrueFalseQuestion and emits boolean value on selection', () => {
        const tfQuestion: Question = {
            id: 'q-tf',
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'The human heart has 4 chambers.',
            payload: { type: 'true_false', correctAnswer: true },
            difficulty: 'easy',
            points: 1,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        const onChange = vi.fn();
        render(<QuestionRenderer question={tfQuestion} value="" onChange={onChange} />);

        const trueRadio = screen.getByLabelText('True');
        fireEvent.click(trueRadio);
        expect(onChange).toHaveBeenCalledWith(true);

        const falseRadio = screen.getByLabelText('False');
        fireEvent.click(falseRadio);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('renders IdentificationQuestion and emits text value on change', () => {
        const identQuestion: Question = {
            id: 'q-id',
            materialId: 'mat-1',
            type: 'identification',
            prompt: 'Identify the primary pacemaker of the heart:',
            payload: { type: 'identification', correctAnswer: 'SA node', acceptedAlternatives: ['Sinoatrial node'] },
            difficulty: 'medium',
            points: 2,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        const onChange = vi.fn();
        render(<QuestionRenderer question={identQuestion} value="" onChange={onChange} />);

        const input = screen.getByPlaceholderText('Type your answer…');
        fireEvent.change(input, { target: { value: 'SA node' } });

        expect(onChange).toHaveBeenCalledWith('SA node');
    });

    it('renders FillBlankQuestion and emits updated array of blank values', () => {
        const fillQuestion: Question = {
            id: 'q-fill',
            materialId: 'mat-1',
            type: 'fill_in_blank',
            prompt: 'Fill in the blanks:',
            payload: { type: 'fill_in_blank', template: 'DNA is transcribed to ___ and translated to ___.', blanks: ['RNA', 'protein'] },
            difficulty: 'hard',
            points: 2,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        const onChange = vi.fn();
        render(<QuestionRenderer question={fillQuestion} value={['RNA']} onChange={onChange} />);

        const blank2 = screen.getByPlaceholderText('blank 2');
        fireEvent.change(blank2, { target: { value: 'protein' } });

        expect(onChange).toHaveBeenCalledWith(['RNA', 'protein']);
    });
});
