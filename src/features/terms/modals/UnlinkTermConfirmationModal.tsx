import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';

interface UnlinkTermConfirmationModalProps {
  /** Title of the term being unlinked (used in the accessible button label). */
  termTitle: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal before unlinking a term from a subject.
 *
 * Unlinking only removes the Subject ↔ Term association — the global term
 * remains available for other subjects.
 */
export default function UnlinkTermConfirmationModal({
  termTitle,
  isPending = false,
  onConfirm,
  onCancel,
}: UnlinkTermConfirmationModalProps) {
  return (
    <ConfirmationDialog
      isOpen
      title="Unlink from subject?"
      message={`"${termTitle}" will be removed from this subject. This removes the term association from this subject. The global term remains available for other subjects.`}
      confirmLabel={isPending ? 'Unlinking...' : 'Unlink'}
      cancelLabel="Cancel"
      intent="warning"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
