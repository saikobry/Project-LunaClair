import * as stylex from '@stylexjs/stylex';
import { Sparkles } from 'lucide-react';

const mobile = '@media (max-width: 640px)';

const pulse = stylex.keyframes({
  '0%': { transform: 'scale(0.9)', opacity: 0.6 },
  '50%': { transform: 'scale(1.15)', opacity: 1 },
  '100%': { transform: 'scale(0.9)', opacity: 0.6 },
});

const styles = stylex.create({
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface, #ffffff)',
    color: 'var(--color-text-primary, #111827)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.06)',
      borderColor: 'var(--color-accent)',
      color: 'var(--color-accent)',
    },
  },
  buttonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
  icon: {
    width: 15,
    height: 15,
  },
  label: {
    [mobile]: {
      display: 'none',
    },
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: 'var(--color-accent)',
    border: '2px solid var(--color-surface, #ffffff)',
  },
  badgeStreaming: {
    animationName: pulse,
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
});

export interface AiDrawerToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  isStreaming?: boolean;
  hasUnread?: boolean;
}

export function AiDrawerToggleButton({
  isOpen,
  onToggle,
  isStreaming = false,
  hasUnread = false,
}: AiDrawerToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle AI Study Assistant"
      aria-expanded={isOpen}
      title="AI Study Assistant"
      {...stylex.props(styles.button, isOpen && styles.buttonActive)}
    >
      <Sparkles {...stylex.props(styles.icon)} aria-hidden="true" />
      <span {...stylex.props(styles.label)}>AI Assistant</span>
      {isStreaming && (
        <span
          {...stylex.props(styles.badge, styles.badgeStreaming)}
          aria-label="AI is currently generating"
        />
      )}
      {!isStreaming && hasUnread && !isOpen && (
        <span
          {...stylex.props(styles.badge)}
          aria-label="New unread AI response"
        />
      )}
    </button>
  );
}
