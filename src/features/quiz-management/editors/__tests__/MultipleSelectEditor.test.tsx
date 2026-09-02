import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultipleSelectEditor } from '../MultipleSelectEditor';
import type { MultipleSelectPayload } from '../../../../domain/quiz/models/AnswerPayload';

describe('MultipleSelectEditor', () => {
    it('renders choices and emits updated choice text on change', () => {
        const payload: MultipleSelectPayload = {
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [0],
        };
        const onChange = vi.fn();

        render(<MultipleSelectEditor value={payload} onChange={onChange} />);

        const input2 = screen.getByPlaceholderText('Choice 2');
        fireEvent.change(input2, { target: { value: 'Updated Option B' } });

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_select',
            choices: ['Option A', 'Updated Option B'],
            correctIndices: [0],
        });
    });

    it('adds a new choice when clicking Add Choice', () => {
        const payload: MultipleSelectPayload = {
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [],
        };
        const onChange = vi.fn();

        render(<MultipleSelectEditor value={payload} onChange={onChange} />);

        const addButton = screen.getByRole('button', { name: /Add choice/i });
        fireEvent.click(addButton);

        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_select',
            choices: ['Option A', 'Option B', ''],
            correctIndices: [],
        });
    });

    it('toggles correctIndices on and off', () => {
        const payload: MultipleSelectPayload = {
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [0],
        };
        const onChange = vi.fn();

        const { rerender } = render(<MultipleSelectEditor value={payload} onChange={onChange} />);

        // Toggle Option B (index 1) on
        const toggleOption2 = screen.getByRole('button', { name: /Mark choice 2 as correct/i });
        fireEvent.click(toggleOption2);
        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [0, 1],
        });

        // Rerender with [0, 1] selected, then toggle Option A (index 0) off
        rerender(
            <MultipleSelectEditor
                value={{ type: 'multiple_select', choices: ['Option A', 'Option B'], correctIndices: [0, 1] }}
                onChange={onChange}
            />,
        );
        const toggleOption1 = screen.getByRole('button', { name: /Mark choice 1 as correct/i });
        fireEvent.click(toggleOption1);
        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [1],
        });
    });

    it('removes choice and shifts remaining correct indices down', () => {
        // Choice 0: A, Choice 1: B (correct), Choice 2: C (correct)
        const payload: MultipleSelectPayload = {
            type: 'multiple_select',
            choices: ['Option A', 'Option B', 'Option C'],
            correctIndices: [1, 2],
        };
        const onChange = vi.fn();

        render(<MultipleSelectEditor value={payload} onChange={onChange} />);

        // Remove Choice 1 (Option B)
        const removeOption2 = screen.getByRole('button', { name: /Remove choice 2/i });
        fireEvent.click(removeOption2);

        // Index 1 was deleted; index 2 (Option C) shifts to index 1
        expect(onChange).toHaveBeenCalledWith({
            type: 'multiple_select',
            choices: ['Option A', 'Option C'],
            correctIndices: [1],
        });
    });

    it('disables removal buttons when there are 2 or fewer choices', () => {
        const payload: MultipleSelectPayload = {
            type: 'multiple_select',
            choices: ['Option A', 'Option B'],
            correctIndices: [0],
        };
        const onChange = vi.fn();

        render(<MultipleSelectEditor value={payload} onChange={onChange} />);

        const removeButton = screen.getByRole('button', { name: /Remove choice 1/i });
        expect(removeButton).toBeDisabled();
    });
});
