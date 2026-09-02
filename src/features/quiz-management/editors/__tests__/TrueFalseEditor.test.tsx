import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrueFalseEditor } from '../TrueFalseEditor';
import type { TrueFalsePayload } from '../../../../domain/quiz/models/AnswerPayload';

describe('TrueFalseEditor', () => {
    it('renders True and False options and indicates current selection', () => {
        const payload: TrueFalsePayload = {
            type: 'true_false',
            correctAnswer: true,
        };
        const onChange = vi.fn();

        render(<TrueFalseEditor value={payload} onChange={onChange} />);

        expect(screen.getByText('True')).toBeInTheDocument();
        expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('emits updated payload when toggling from True to False', () => {
        const payload: TrueFalsePayload = {
            type: 'true_false',
            correctAnswer: true,
        };
        const onChange = vi.fn();

        render(<TrueFalseEditor value={payload} onChange={onChange} />);

        const markFalse = screen.getByRole('button', { name: /Mark False as correct/i });
        fireEvent.click(markFalse);

        expect(onChange).toHaveBeenCalledWith({
            type: 'true_false',
            correctAnswer: false,
        });
    });

    it('emits updated payload when clicking True', () => {
        const payload: TrueFalsePayload = {
            type: 'true_false',
            correctAnswer: false,
        };
        const onChange = vi.fn();

        render(<TrueFalseEditor value={payload} onChange={onChange} />);

        const markTrue = screen.getByRole('button', { name: /Mark True as correct/i });
        fireEvent.click(markTrue);

        expect(onChange).toHaveBeenCalledWith({
            type: 'true_false',
            correctAnswer: true,
        });
    });
});
