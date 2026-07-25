import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import { styles } from '../styles/library.stylex';

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
    <Dialog isOpen onClose={onClose} title="Delete Material" width={400}>
      <p {...stylex.props(styles.modalDescription)}>
        Are you sure you want to delete <strong>{title}</strong>? This action
        cannot be undone.
      </p>

      <div {...stylex.props(styles.modalActions)}>
        <Button label="Cancel" variant="secondary" onClick={onClose} />
        <Button
          label="Delete"
          variant="danger"
          onClick={onConfirm}
        />
      </div>
    </Dialog>
  );
}
