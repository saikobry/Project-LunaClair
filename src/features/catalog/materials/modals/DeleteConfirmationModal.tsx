import { ConfirmationDialog } from '../../../../shared/ui/Dialog/ConfirmationDialog';

interface DeleteConfirmationModalProps {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
  /** What kind of item is being deleted, used in the dialog title. @default 'Material' */
  itemType?: string;
}

export default function DeleteConfirmationModal({
  title,
  onConfirm,
  onClose,
  itemType = 'Material',
}: DeleteConfirmationModalProps) {
  return (
    <ConfirmationDialog
      isOpen
      title={`Delete ${itemType}`}
      message={`Are you sure you want to delete ${title}? This action cannot be undone.`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      intent="danger"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
