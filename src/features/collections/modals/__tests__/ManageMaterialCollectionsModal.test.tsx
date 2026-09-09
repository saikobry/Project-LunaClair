import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageMaterialCollectionsModal } from '../ManageMaterialCollectionsModal';
import type { Collection } from '../../../../domain/collections/models/Collection';

const mockCollections: Collection[] = [
    {
        id: 'col-1',
        title: 'Exam Prep',
        description: 'Finals sprint',
        icon: 'star',
        color: '#fbbf24',
        order: 0,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
        id: 'col-2',
        title: 'Quick Revision',
        order: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    },
];

describe('ManageMaterialCollectionsModal', () => {
    function renderModal(props: Partial<Parameters<typeof ManageMaterialCollectionsModal>[0]> = {}) {
        const onToggle = vi.fn().mockResolvedValue(undefined);
        const onCreateNewCollection = vi.fn();
        const onClose = vi.fn();
        const utils = render(
            <ManageMaterialCollectionsModal
                isOpen={true}
                materialId="mat-1"
                materialTitle="Cell Biology"
                collections={mockCollections}
                assignedCollectionIds={['col-1']}
                onToggle={onToggle}
                onCreateNewCollection={onCreateNewCollection}
                onClose={onClose}
                {...props}
            />,
        );
        return { ...utils, onToggle, onCreateNewCollection, onClose };
    }

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders all collections with checkboxes reflecting assignment state', () => {
        renderModal();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Cell Biology/)).toBeInTheDocument();

        const examPrep = screen.getByRole('checkbox', { name: /Include Exam Prep/ }) as HTMLInputElement;
        const quickRevision = screen.getByRole('checkbox', { name: /Include Quick Revision/ }) as HTMLInputElement;

        expect(examPrep.checked).toBe(true);
        expect(quickRevision.checked).toBe(false);
    });

    it('calls onToggle(collectionId, true) when an unassigned collection is checked', async () => {
        const { onToggle } = renderModal();

        fireEvent.click(screen.getByRole('checkbox', { name: /Include Quick Revision/ }));

        await waitFor(() => {
            expect(onToggle).toHaveBeenCalledWith('col-2', true);
        });
    });

    it('calls onToggle(collectionId, false) when an assigned collection is unchecked', async () => {
        const { onToggle } = renderModal();

        fireEvent.click(screen.getByRole('checkbox', { name: /Include Exam Prep/ }));

        await waitFor(() => {
            expect(onToggle).toHaveBeenCalledWith('col-1', false);
        });
    });

    it('shows the empty state with a Create Collection button when there are no collections', () => {
        renderModal({ collections: [], assignedCollectionIds: [] });

        expect(screen.getByText('No collections created yet')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Create Collection' }).length).toBeGreaterThan(0);
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('invokes onCreateNewCollection from the empty state button', () => {
        const { onCreateNewCollection } = renderModal({ collections: [], assignedCollectionIds: [] });

        fireEvent.click(screen.getAllByRole('button', { name: 'Create Collection' })[0]);
        expect(onCreateNewCollection).toHaveBeenCalledTimes(1);
    });

    it('hides the create action when onCreateNewCollection is not provided', () => {
        renderModal({ onCreateNewCollection: undefined });

        expect(screen.queryByRole('button', { name: 'Create Collection' })).not.toBeInTheDocument();
    });

    it('renders the footer Create Collection action when collections exist', () => {
        const { onCreateNewCollection } = renderModal();

        const footerCreate = screen.getByRole('button', { name: 'Create Collection' });
        fireEvent.click(footerCreate);
        expect(onCreateNewCollection).toHaveBeenCalledTimes(1);
    });

    it('closes when Done is clicked', () => {
        const { onClose } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
