import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultipleChoiceEditor } from '../MultipleChoiceEditor';
import type { MultipleChoicePayload } from '../../../../domain/quiz/models/AnswerPayload';

describe('MultipleChoiceEditor', () => {
    it('renders choices and emits updated choice text on change', () => {
        const payload: MultipleChoicePayload = {
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 0,
        };
        const onChange = vi.fn();

        render(<MultipleChoiceEditor value={payload} onChange={onChange} />);

        const input1 = screen.getByPlaceholderText('Choice 1');
        fireEvent.change(input1, { target: { value: 'Updated Choice 1' } });

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_choice',
            choices: ['Updated Choice 1', 'Choice 2'],
            correctIndex: 0,
        });
    });

    it('adds a new choice when clicking Add Choice button', () => {
        const payload: MultipleChoicePayload = {
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 0,
        };
        const onChange = vi.fn();

        render(<MultipleChoiceEditor value={payload} onChange={onChange} />);

        const addButton = screen.getByRole('button', { name: /Add choice/i });
        fireEvent.click(addButton);

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2', ''],
            correctIndex: 0,
        });
    });

    it('changes the selected correct index when clicking correct answer indicator', () => {
        const payload: MultipleChoicePayload = {
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 0,
        };
        const onChange = vi.fn();

        render(<MultipleChoiceEditor value={payload} onChange={onChange} />);

        const markChoice2 = screen.getByRole('button', { name: /Mark choice 2 as correct/i });
        fireEvent.click(markChoice2);

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 1,
        });
    });

    it('removes a choice and adjusts correctIndex if out of bounds', () => {
        const payload: MultipleChoicePayload = {
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2', 'Choice 3'],
            correctIndex: 2,
        };
        const onChange = vi.fn();

        render(<MultipleChoiceEditor value={payload} onChange={onChange} />);

        const removeChoice3 = screen.getByRole('button', { name: /Remove choice 3/i });
        fireEvent.click(removeChoice3);

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 0, // Clamped from 2 back to 0
        });
    });

    it('disables removal buttons when there are 2 or fewer choices', () => {
        const payload: MultipleChoicePayload = {
            type: 'multiple_choice',
            choices: ['Choice 1', 'Choice 2'],
            correctIndex: 0,
        };
        const onChange = vi.fn();

        render(<MultipleChoiceEditor value={payload} onChange={onChange} />);

        const removeButton1 = screen.getByRole('button', { name: /Remove choice 1/i });
        expect(removeButton1).toBeDisabled();
    });
});
