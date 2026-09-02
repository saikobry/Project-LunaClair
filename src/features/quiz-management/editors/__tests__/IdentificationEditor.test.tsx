import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdentificationEditor } from '../IdentificationEditor';
import type { IdentificationPayload } from '../../../../domain/quiz/models/AnswerPayload';

describe('IdentificationEditor', () => {
    it('renders primary answer and updates on change', () => {
        const payload: IdentificationPayload = {
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: [],
        };
        const onChange = vi.fn();

        render(<IdentificationEditor value={payload} onChange={onChange} />);

        const input = screen.getByPlaceholderText('Primary correct answer');
        fireEvent.change(input, { target: { value: 'Mitochondrion' } });

        expect(onChange).toHaveBeenCalledWith({
            type: 'identification',
            correctAnswer: 'Mitochondrion',
            acceptedAlternatives: [],
        });
    });

    it('adds an accepted alternative answer', () => {
        const payload: IdentificationPayload = {
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: [],
        };
        const onChange = vi.fn();

        render(<IdentificationEditor value={payload} onChange={onChange} />);

        const addAltButton = screen.getByRole('button', { name: /Add alternative/i });
        fireEvent.click(addAltButton);

        expect(onChange).toHaveBeenCalledWith({
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: [''],
        });
    });

    it('updates text of an accepted alternative answer', () => {
        const payload: IdentificationPayload = {
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: ['Mitochondrion'],
        };
        const onChange = vi.fn();

        render(<IdentificationEditor value={payload} onChange={onChange} />);

        const altInput = screen.getByPlaceholderText('Alternative 1');
        fireEvent.change(altInput, { target: { value: 'Chondriosome' } });

        expect(onChange).toHaveBeenCalledWith({
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: ['Chondriosome'],
        });
    });

    it('removes an accepted alternative answer', () => {
        const payload: IdentificationPayload = {
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: ['Alt 1', 'Alt 2'],
        };
        const onChange = vi.fn();

        render(<IdentificationEditor value={payload} onChange={onChange} />);

        const removeAlt1 = screen.getByRole('button', { name: /Remove alternative 1/i });
        fireEvent.click(removeAlt1);

        expect(onChange).toHaveBeenCalledWith({
            type: 'identification',
            correctAnswer: 'Mitochondria',
            acceptedAlternatives: ['Alt 2'],
        });
    });
});
