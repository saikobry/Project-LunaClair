import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FillBlankEditor } from '../FillBlankEditor';
import type { FillBlankPayload } from '../../../../domain/quiz/models/AnswerPayload';

describe('FillBlankEditor', () => {
    it('updates template and dynamically recalculates blank inputs', () => {
        const payload: FillBlankPayload = {
            type: 'fill_in_blank',
            template: 'The ___ is the capital of France.',
            blanks: ['Paris'],
        };
        const onChange = vi.fn();

        render(<FillBlankEditor value={payload} onChange={onChange} />);

        const textarea = screen.getByPlaceholderText('The ___ is the largest organ in the body.');
        // Add a second blank
        fireEvent.change(textarea, {
            target: { value: 'The ___ is the capital of France, and ___ is the capital of Germany.' },
        });

        expect(onChange).toHaveBeenCalledWith({
            type: 'fill_in_blank',
            template: 'The ___ is the capital of France, and ___ is the capital of Germany.',
            blanks: ['Paris', ''],
        });
    });

    it('shrinks blanks array when blanks are removed from template', () => {
        const payload: FillBlankPayload = {
            type: 'fill_in_blank',
            template: 'The ___ is ___ in the body.',
            blanks: ['heart', 'vital'],
        };
        const onChange = vi.fn();

        render(<FillBlankEditor value={payload} onChange={onChange} />);

        const textarea = screen.getByPlaceholderText('The ___ is the largest organ in the body.');
        // Remove one blank
        fireEvent.change(textarea, {
            target: { value: 'The ___ is vital in the body.' },
        });

        expect(onChange).toHaveBeenCalledWith({
            type: 'fill_in_blank',
            template: 'The ___ is vital in the body.',
            blanks: ['heart'],
        });
    });

    it('updates individual blank answer text', () => {
        const payload: FillBlankPayload = {
            type: 'fill_in_blank',
            template: 'The ___ is the capital of France.',
            blanks: [''],
        };
        const onChange = vi.fn();

        render(<FillBlankEditor value={payload} onChange={onChange} />);

        const blankInput = screen.getByPlaceholderText('Answer for blank 1');
        fireEvent.change(blankInput, { target: { value: 'Paris' } });

        expect(onChange).toHaveBeenCalledWith({
            type: 'fill_in_blank',
            template: 'The ___ is the capital of France.',
            blanks: ['Paris'],
        });
    });
});
