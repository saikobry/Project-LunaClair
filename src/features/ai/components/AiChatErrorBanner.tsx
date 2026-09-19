import * as stylex from '@stylexjs/stylex';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';

const styles = stylex.create({
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 16px',
    borderTop: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
    backgroundColor: 'var(--color-error-muted)',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  icon: {
    width: 15,
    height: 15,
    flexShrink: 0,
    color: 'var(--color-error)',
  },
  message: {
    fontSize: 13,
    lineHeight: 1.4,
    color: 'var(--color-error)',
  },
});

export interface AiChatErrorBannerProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Request-level failure surface for the AI drawer.
 *
 * Failures that were persisted as their own turn render inline in the
 * transcript; this banner exists for the ones that left no turn behind — a
 * stalled first token, a transport failure, or a session that could not be
 * created — so the drawer never fails silently.
 */
export function AiChatErrorBanner({ message, onRetry, onDismiss }: AiChatErrorBannerProps) {
  return (
    <div {...stylex.props(styles.banner)} role="alert">
      <div {...stylex.props(styles.content)}>
        <AlertCircle {...stylex.props(styles.icon)} aria-hidden="true" />
        <span {...stylex.props(styles.message)}>{message}</span>
      </div>
      <div {...stylex.props(styles.content)}>
        <Button
          label="Retry the request"
          variant="secondary"
          icon={<RotateCcw size={12} />}
          onClick={onRetry}
          style={{ minHeight: 28, padding: '4px 10px', fontSize: 12 }}
        >
          Retry
        </Button>
        <Button
          label="Dismiss this error"
          variant="ghost"
          onClick={onDismiss}
          style={{ minHeight: 28, padding: '4px 10px', fontSize: 12 }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
