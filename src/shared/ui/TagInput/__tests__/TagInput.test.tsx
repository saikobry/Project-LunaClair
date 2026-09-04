import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagInput } from '../TagInput';

describe('TagInput', () => {
    it('renders field label and existing tag tokens', () => {
        render(
            <TagInput
                label="Course Tags"
                tags={['algebra', 'calculus']}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('Course Tags')).toBeInTheDocument();
        expect(screen.getByText('#algebra')).toBeInTheDocument();
        expect(screen.getByText('#calculus')).toBeInTheDocument();
    });

    it('hides label visually when labelHidden is true', () => {
        render(
            <TagInput
                label="Course Tags"
                labelHidden
                tags={['biology']}
                onChange={vi.fn()}
            />
        );

        expect(screen.queryByText('Course Tags')).not.toBeInTheDocument();
        expect(screen.getByText('#biology')).toBeInTheDocument();
    });

    it('adds a tag on Enter / form submit, trimming and stripping leading hash', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['math']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.change(input, { target: { value: '  #physics  ' } });
        fireEvent.submit(input.closest('form')!);

        expect(onChange).toHaveBeenCalledWith(['math', 'physics']);
        expect(input).toHaveValue('');
    });

    it('adds a tag on comma key press', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['science']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.change(input, { target: { value: 'astronomy' } });
        fireEvent.keyDown(input, { key: ',' });

        expect(onChange).toHaveBeenCalledWith(['science', 'astronomy']);
        expect(input).toHaveValue('');
    });

    it('deduplicates tags case-insensitively', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['Genetics']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.change(input, { target: { value: 'genetics' } });
        fireEvent.submit(input.closest('form')!);

        // Existing 'Genetics' is preserved, lowercase duplicate not added
        expect(onChange).toHaveBeenCalledWith(['Genetics']);
    });

    it('removes tag when token remove button is clicked', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['red', 'green', 'blue']}
                onChange={onChange}
            />
        );

        // Find remove buttons for tokens (Token renders aria-label "Remove <tag>")
        const removeGreenBtn = screen.getByRole('button', { name: /Remove #green/i });
        fireEvent.click(removeGreenBtn);

        expect(onChange).toHaveBeenCalledWith(['red', 'blue']);
    });

    it('commits pending input on blur so modal saves do not drop typed token', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['existing']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.change(input, { target: { value: 'blurredTag' } });
        fireEvent.blur(input.closest('div[onblur]') || input);

        expect(onChange).toHaveBeenCalledWith(['existing', 'blurredTag']);
    });

    it('handles comma-separated paste by committing complete tokens and leaving trailing segment', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['base']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.paste(input, {
            clipboardData: {
                getData: () => 'alpha, beta, gamma, delta',
            },
        });

        expect(onChange).toHaveBeenCalledWith(['base', 'alpha', 'beta', 'gamma']);
        expect(input).toHaveValue('delta');
    });

    it('ignores empty inputs on submit', () => {
        const onChange = vi.fn();
        render(
            <TagInput
                tags={['item']}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Type a tag and press Enter…');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.submit(input.closest('form')!);

        expect(onChange).not.toHaveBeenCalled();
    });
});
