import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ConfirmationDialog
        isOpen={false}
        title="Delete Item"
        message="Are you sure you want to delete this?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, message, and default button labels when open', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Delete Item"
        message="Are you sure you want to delete this?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders custom confirm and cancel labels when provided', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Remove Access"
        message="This will revoke all permissions."
        confirmLabel="Revoke"
        cancelLabel="Keep Access"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Access' })).toBeInTheDocument();
  });

  it('invokes onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        isOpen={true}
        title="Archive Note"
        message="Move note to archive?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('invokes onCancel when cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        isOpen={true}
        title="Archive Note"
        message="Move note to archive?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('invokes onCancel when dialog close icon button is clicked', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        isOpen={true}
        title="Close Dialog"
        message="Testing close header button."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const closeIconButton = screen.getByLabelText('Close');
    fireEvent.click(closeIconButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders warning intent without error', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Warning Action"
        message="This action requires caution."
        intent="warning"
        confirmLabel="Proceed"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Proceed' })).toBeInTheDocument();
  });

  it('auto-focuses the confirm button when opened', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    render(
      <ConfirmationDialog
        isOpen={true}
        title="Auto Focus Test"
        message="Confirm button should be focused."
        confirmLabel="Accept"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(rafSpy).toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', { name: 'Accept' });
    expect(document.activeElement).toBe(confirmBtn);

    rafSpy.mockRestore();
  });
});
