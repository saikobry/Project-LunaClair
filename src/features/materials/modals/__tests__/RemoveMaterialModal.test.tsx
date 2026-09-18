import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RemoveMaterialModal from '../RemoveMaterialModal';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const createdHere: StudyMaterial = {
  id: 'mat-1',
  title: 'Cell Biology',
  documentId: 'doc-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

/** A material that came from Explore carries `originShareId` — its share still exists on the server. */
const cloned: StudyMaterial = { ...createdHere, originShareId: 'pkg_share_abc' };

function renderModal(material: StudyMaterial) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<RemoveMaterialModal material={material} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
}

describe('RemoveMaterialModal', () => {
  it('names every store the removal cascade empties', () => {
    renderModal(cloned);

    expect(screen.getByText('Remove from Library?')).toBeInTheDocument();

    const message = screen.getByText(/Removing "Cell Biology"/);
    expect(message).toHaveTextContent('its document');
    expect(message).toHaveTextContent('questions and quizzes');
    expect(message).toHaveTextContent('files stored with it');
    expect(message).toHaveTextContent('its place in your collections');
  });

  it('offers recovery for a cloned material, without promising local edits back', () => {
    renderModal(cloned);

    const message = screen.getByText(/Removing "Cell Biology"/);
    expect(message).toHaveTextContent('clone the share again from Explore');
    expect(message).toHaveTextContent('anything you added or edited here is gone');
  });

  it('warns that a material created on this device cannot be restored', () => {
    renderModal(createdHere);

    const message = screen.getByText(/Removing "Cell Biology"/);
    expect(message).toHaveTextContent('not published anywhere');
    expect(message).toHaveTextContent('cannot be restored');
    expect(message).not.toHaveTextContent('Explore');
  });

  it('wires confirm and cancel to the dialog actions', () => {
    const { onConfirm, onClose } = renderModal(cloned);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from Library' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
