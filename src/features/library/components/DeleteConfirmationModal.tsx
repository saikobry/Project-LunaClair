import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';

interface DeleteConfirmationModalProps {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmationModal({
  title,
  onConfirm,
  onClose,
}: DeleteConfirmationModalProps) {
  return (
    <ConfirmationDialog
      isOpen
      title="Delete Material"
      message={`Are you sure you want to delete ${title}? This action cannot be undone.`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      intent="danger"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
