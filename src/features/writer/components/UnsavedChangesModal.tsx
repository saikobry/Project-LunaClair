import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';

export interface UnsavedChangesModalProps {
  isOpen: boolean;
  onStay: () => void;
  onDiscard: () => void;
  materialTitle?: string;
}

/**
 * Modal dialog presented when a user attempts to switch materials while
 * the active Writer editor draft has unsaved changes.
 */
export function UnsavedChangesModal({
  isOpen,
  onStay,
  onDiscard,
  materialTitle,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  const message = materialTitle
    ? `You have unsaved changes in "${materialTitle}". If you switch materials now, your changes will be discarded.`
    : 'You have unsaved changes in this document. If you switch materials now, your changes will be discarded.';

  return (
    <ConfirmationDialog
      isOpen={isOpen}
      title="Unsaved Changes"
      message={message}
      confirmLabel="Discard & Switch"
      cancelLabel="Stay in Editor"
      intent="danger"
      onConfirm={onDiscard}
      onCancel={onStay}
    />
  );
}
