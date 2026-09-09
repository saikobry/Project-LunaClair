import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateCollectionModal } from '../CreateCollectionModal';
import { COLLECTION_COLOR_PRESETS, COLLECTION_ICON_NAMES } from '../collectionAppearance';

describe('CreateCollectionModal', () => {
    function renderModal(props: Partial<Parameters<typeof CreateCollectionModal>[0]> = {}) {
        const onSave = vi.fn();
        const onClose = vi.fn();
        const utils = render(
            <CreateCollectionModal isOpen={true} onSave={onSave} onClose={onClose} {...props} />,
        );
        return { ...utils, onSave, onClose };
    }

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders title and description fields plus color and icon groups', () => {
        renderModal();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('New Collection')).toBeInTheDocument();
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
        expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Color' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Icon' })).toBeInTheDocument();
    });

    it('renders all color presets and icon options', () => {
        renderModal();

        for (const preset of COLLECTION_COLOR_PRESETS) {
            expect(screen.getByRole('radio', { name: `${preset.name} color` })).toBeInTheDocument();
        }
        for (const name of COLLECTION_ICON_NAMES) {
            expect(screen.getByRole('radio', { name: `${name} icon` })).toBeInTheDocument();
        }
    });

    it('disables the submit button while the title is empty', () => {
        renderModal();

        const submit = screen.getByRole('button', { name: 'Create Collection' });
        expect(submit).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Physics' } });
        expect(submit).toBeEnabled();
    });

    it('submits trimmed title and optional description without color/icon', () => {
        const { onSave } = renderModal();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Exam Prep  ' } });
        fireEvent.change(screen.getByLabelText('Description (optional)'), {
            target: { value: 'Finals sprint' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));

        expect(onSave).toHaveBeenCalledWith({
            title: 'Exam Prep',
            description: 'Finals sprint',
            icon: undefined,
            color: undefined,
        });
    });

    it('does not submit when the title is blank', () => {
        const { onSave } = renderModal();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));

        expect(onSave).not.toHaveBeenCalled();
    });

    it('submits selected color and icon', () => {
        const { onSave } = renderModal();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Languages' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Purple color' }));
        fireEvent.click(screen.getByRole('radio', { name: 'star icon' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));

        expect(onSave).toHaveBeenCalledWith({
            title: 'Languages',
            description: undefined,
            icon: 'star',
            color: COLLECTION_COLOR_PRESETS.find((p) => p.name === 'Purple')?.hex,
        });
    });

    it('toggles a selected color off when clicked again', () => {
        const { onSave } = renderModal();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Languages' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Blue color' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Blue color' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Languages', color: undefined }),
        );
    });

    it('closes when Cancel is clicked', () => {
        const { onClose } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resets the draft when reopened', () => {
        const { rerender } = renderModal();

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Stale draft' } });

        rerender(
            <CreateCollectionModal isOpen={false} onSave={vi.fn()} onClose={vi.fn()} />,
        );
        rerender(
            <CreateCollectionModal isOpen={true} onSave={vi.fn()} onClose={vi.fn()} />,
        );

        expect(screen.getByLabelText('Title')).toHaveValue('');
    });
});
