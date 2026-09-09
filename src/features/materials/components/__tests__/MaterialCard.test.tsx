import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialCard } from '../MaterialCard';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const mockMaterial: StudyMaterial = {
  id: 'mat-1',
  title: 'Cell Biology',
  documentId: 'doc-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function renderCard(props: Partial<Parameters<typeof MaterialCard>[0]> = {}) {
  const onOpen = vi.fn();
  const onManageCollections = vi.fn();
  const utils = render(
    <MaterialCard
      material={mockMaterial}
      onOpen={onOpen}
      onManageCollections={onManageCollections}
      {...props}
    />,
  );
  return { ...utils, onOpen, onManageCollections };
}

describe('MaterialCard', () => {
  it('renders the card with material title', () => {
    renderCard();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
  });

  it('shows "Add to Collection..." menu item when onManageCollections is provided', () => {
    renderCard();
    expect(screen.getByText('Add to Collection...')).toBeInTheDocument();
  });

  it('hides "Add to Collection..." when onManageCollections is not provided', () => {
    render(
      <MaterialCard
        material={mockMaterial}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByText('Add to Collection...')).not.toBeInTheDocument();
  });

  it('calls onManageCollections when "Add to Collection..." is clicked', () => {
    const { onManageCollections } = renderCard();
    fireEvent.click(screen.getByText('Add to Collection...'));
    expect(onManageCollections).toHaveBeenCalledTimes(1);
    expect(onManageCollections).toHaveBeenCalledWith(mockMaterial);
  });
});
