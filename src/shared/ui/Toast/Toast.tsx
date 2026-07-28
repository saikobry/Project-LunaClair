import * as stylex from '@stylexjs/stylex';
import { Toast as AstryxToast } from '@astryxdesign/core/Toast';
import type { ToastType } from '@astryxdesign/core/Toast';

export type ToastIntent = 'success' | 'error' | 'warning' | 'info';

const styles = stylex.create({
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 9999,
    width: 'min(400px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
  },
});

/** Map LunaClair ToastIntent to Astryx ToastType. */
function mapIntent(intent: ToastIntent): ToastType {
  return intent === 'error' ? 'error' : 'info';
}

export interface ToastData {
  id: string;
  title?: string;
  message: string;
  intent: ToastIntent;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  return (
    <AstryxToast
      type={mapIntent(toast.intent)}
      body={toast.title ? `${toast.title}: ${toast.message}` : toast.message}
      isAutoHide={(toast.duration ?? 4000) > 0}
      autoHideDuration={toast.duration ?? 4000}
      onDismiss={() => onDismiss(toast.id)}
    />
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

/**
 * ToastContainer — renders active toasts as a fixed overlay.
 * Delegates individual toast rendering to @astryxdesign/core Toast.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div {...stylex.props(styles.container)} aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
