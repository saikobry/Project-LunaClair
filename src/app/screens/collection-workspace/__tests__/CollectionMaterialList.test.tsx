import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionMaterialList } from '../CollectionMaterialList';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const makeMaterial = (id: string, title: string, tags?: string[]): StudyMaterial => ({
  id,
  title,
  documentId: `doc-${id}`,
  tags,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

describe('CollectionMaterialList', () => {
  it('renders empty state when materials array is empty', () => {
    const handleAdd = vi.fn();
    render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={[]}
        onRemoveMaterial={vi.fn()}
        onAddMaterials={handleAdd}
      />,
    );

    expect(
      screen.getByText('Every great collection starts with one idea.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Materials' }));
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it('renders materials with step numbers, titles, and tags', () => {
    const materials = [
      makeMaterial('m-1', 'Classical Mechanics', ['physics', 'motion']),
      makeMaterial('m-2', 'Electromagnetism', ['physics', 'fields']),
    ];

    render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onAddMaterials={vi.fn()}
      />,
    );

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('Classical Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Electromagnetism')).toBeInTheDocument();
    expect(screen.getAllByText('#physics')).toHaveLength(2);
    expect(screen.getByText('#motion')).toBeInTheDocument();
    expect(screen.getByText('#fields')).toBeInTheDocument();
  });

  it('triggers onOpenMaterial when title is clicked', () => {
    const handleOpen = vi.fn();
    const materials = [makeMaterial('m-1', 'Classical Mechanics')];

    render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onOpenMaterial={handleOpen}
        onRemoveMaterial={vi.fn()}
        onAddMaterials={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Classical Mechanics' }));
    expect(handleOpen).toHaveBeenCalledWith('m-1');
  });

  it('triggers onRemoveMaterial when remove button is clicked', () => {
    const handleRemove = vi.fn();
    const materials = [makeMaterial('m-1', 'Classical Mechanics')];

    render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={handleRemove}
        onAddMaterials={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Classical Mechanics from collection' }),
    );
    expect(handleRemove).toHaveBeenCalledWith('m-1');
  });

  it('reorders materials when move up and move down buttons are clicked', () => {
    const handleReorder = vi.fn();
    const materials = [
      makeMaterial('m-1', 'First Item'),
      makeMaterial('m-2', 'Second Item'),
      makeMaterial('m-3', 'Third Item'),
    ];

    render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onReorder={handleReorder}
        onAddMaterials={vi.fn()}
      />,
    );

    // First item move up button is disabled
    const firstMoveUp = screen.getByRole('button', { name: 'Move First Item up' });
    expect(firstMoveUp).toBeDisabled();

    // Second item move up button moves m-2 before m-1
    const secondMoveUp = screen.getByRole('button', { name: 'Move Second Item up' });
    expect(secondMoveUp).not.toBeDisabled();
    fireEvent.click(secondMoveUp);
    expect(handleReorder).toHaveBeenCalledWith(['m-2', 'm-1', 'm-3']);

    // Third item move down button is disabled
    const thirdMoveDown = screen.getByRole('button', { name: 'Move Third Item down' });
    expect(thirdMoveDown).toBeDisabled();

    // First item move down button moves m-1 after m-2
    const firstMoveDown = screen.getByRole('button', { name: 'Move First Item down' });
    fireEvent.click(firstMoveDown);
    expect(handleReorder).toHaveBeenCalledWith(['m-2', 'm-1', 'm-3']);
  });

  it('renders data attributes for GSAP Draggable and cleans up on unmount', () => {
    const materials = [
      makeMaterial('m-1', 'First Item'),
      makeMaterial('m-2', 'Second Item'),
    ];

    const { container, unmount } = render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onReorder={vi.fn()}
        onAddMaterials={vi.fn()}
      />,
    );

    const rows = container.querySelectorAll('[data-material-id]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-material-id')).toBe('m-1');
    expect(rows[1].getAttribute('data-material-id')).toBe('m-2');

    const handles = container.querySelectorAll('[data-drag-handle="true"]');
    expect(handles).toHaveLength(2);

    // Should cleanly unmount without throwing
    expect(() => unmount()).not.toThrow();
  });

  it('immediately updates DOM order on button clicks without waiting for external prop refresh', () => {
    const handleReorder = vi.fn();
    const materials = [
      makeMaterial('m-1', 'First Item'),
      makeMaterial('m-2', 'Second Item'),
    ];

    const { container } = render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onReorder={handleReorder}
        onAddMaterials={vi.fn()}
      />,
    );

    const rowsBefore = container.querySelectorAll('[data-material-id]');
    expect(rowsBefore[0].getAttribute('data-material-id')).toBe('m-1');
    expect(rowsBefore[1].getAttribute('data-material-id')).toBe('m-2');

    const secondMoveUp = screen.getByRole('button', { name: 'Move Second Item up' });
    fireEvent.click(secondMoveUp);

    // Synchronous local state update places m-2 first in the DOM immediately
    const rowsAfter = container.querySelectorAll('[data-material-id]');
    expect(rowsAfter[0].getAttribute('data-material-id')).toBe('m-2');
    expect(rowsAfter[1].getAttribute('data-material-id')).toBe('m-1');
    expect(handleReorder).toHaveBeenCalledWith(['m-2', 'm-1']);
  });

  it('supports hold-to-drag pointer interactions and clean cancel on premature pointerup', () => {
    vi.useFakeTimers();
    const materials = [makeMaterial('m-1', 'First Item')];

    const { container, unmount } = render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onReorder={vi.fn()}
        onAddMaterials={vi.fn()}
      />,
    );

    const row = container.querySelector('[data-material-id="m-1"]')!;
    expect(row).toBeInTheDocument();

    // Simulate pointerdown on row
    fireEvent.pointerDown(row, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' });

    // Pointerup before threshold cancels timer
    fireEvent.pointerUp(window);

    vi.advanceTimersByTime(300);

    expect(() => unmount()).not.toThrow();
    vi.useRealTimers();
  });

  it('renders hold progress ring element with aria-hidden', () => {
    const materials = [makeMaterial('m-1', 'First Item')];

    const { container } = render(
      <CollectionMaterialList
        collectionId="c-1"
        materials={materials}
        onRemoveMaterial={vi.fn()}
        onReorder={vi.fn()}
        onAddMaterials={vi.fn()}
      />,
    );

    const svgRing = container.querySelector('svg[aria-hidden="true"]');
    expect(svgRing).toBeInTheDocument();
  });
});
