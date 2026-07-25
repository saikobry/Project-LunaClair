import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
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
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div {...stylex.props(styles.overlay)} onKeyDown={handleKeyDown}>
      <div {...stylex.props(styles.modal)} onClick={(e) => e.stopPropagation()}>
        <h2 {...stylex.props(styles.modalTitle)}>Delete Material</h2>
        <p {...stylex.props(styles.modalDescription)}>
          Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.
        </p>

        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.btnSecondary)} onClick={onClose}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            {...stylex.props(styles.btnDanger)}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
