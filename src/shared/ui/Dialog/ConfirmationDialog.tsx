import { useEffect, useId } from 'react';
import * as stylex from '@stylexjs/stylex';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from '../Button';

const styles = stylex.create({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 12,
  },
  messageRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 10,
    flexShrink: 0,
    marginTop: 2,
  },
  iconBoxWarning: {
    background: 'var(--color-warning-muted)',
    color: 'var(--color-warning)',
  },
  iconBoxDanger: {
    background: 'var(--color-error-muted)',
    color: 'var(--color-error)',
  },
  message: {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
    margin: 0,
    flex: 1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 12,
  },
});

export type ConfirmIntent = 'danger' | 'warning';

interface ConfirmationDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Dialog title. */
  title: string;
  /** Confirmation message body. */
  message: string;
  /** Label for the confirm button. @default 'Confirm' */
  confirmLabel?: string;
  /** Label for the cancel button. @default 'Cancel' */
  cancelLabel?: string;
  /** Visual intent for the confirm button. @default 'danger' */
  intent?: ConfirmIntent;
  /** Callback on confirm. */
  onConfirm: () => void;
  /** Callback on cancel / dismiss. */
  onCancel: () => void;
}

/**
 * LunaClair ConfirmationDialog — replaces `window.confirm` and
 * `window.alert` with an Astryx-styled modal dialog.
 *
 * Features:
 * - Keyboard focus trapping (handled by Astryx Dialog)
 * - Escape key dismissal
 * - Auto-focuses confirm button on open for Enter key confirmation
 * - Icon + message layout for clarity
 */
export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  intent = 'danger',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  // Unique scoped ID so each dialog instance uses its own selector
  const uid = useId();

  // Auto-focus the confirm button when the dialog opens,
  // so pressing Enter triggers confirmation immediately.
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const wrapper = document.querySelector(`[data-confirm-btn="${uid}"]`);
      const btn = wrapper?.querySelector('button');
      if (btn instanceof HTMLElement) btn.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, uid]);

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} width={400}>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.messageRow)}>
          <div
            {...stylex.props(
              styles.iconBox,
              intent === 'danger' ? styles.iconBoxDanger : styles.iconBoxWarning,
            )}
          >
            <AlertTriangle size={18} />
          </div>
          <p {...stylex.props(styles.message)}>{message}</p>
        </div>
        <div {...stylex.props(styles.actions)}>
          <Button
            label={cancelLabel}
            variant="secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <div data-confirm-btn={uid}>
            <Button
              label={confirmLabel}
              variant={intent === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
