import * as stylex from '@stylexjs/stylex';
import { Bot } from 'lucide-react';

const pulseKeyframes = stylex.keyframes({
  '0%': { opacity: 0.4, transform: 'scale(0.95)' },
  '50%': { opacity: 1, transform: 'scale(1)' },
  '100%': { opacity: 0.4, transform: 'scale(0.95)' },
});

const styles = stylex.create({
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: '16px',
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.04))',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
  },
  icon: {
    width: 14,
    height: 14,
    color: 'var(--color-accent)',
    animationName: pulseKeyframes,
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
  dotGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: 'var(--color-accent)',
    animationName: pulseKeyframes,
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
  dot1: {
    animationDelay: '0s',
  },
  dot2: {
    animationDelay: '0.2s',
  },
  dot3: {
    animationDelay: '0.4s',
  },
});

export interface AiStreamingIndicatorProps {
  label?: string;
}

export function AiStreamingIndicator({ label = 'AI is thinking…' }: AiStreamingIndicatorProps) {
  return (
    <div
      {...stylex.props(styles.container)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Bot {...stylex.props(styles.icon)} aria-hidden="true" />
      <span>{label}</span>
      <span {...stylex.props(styles.dotGroup)} aria-hidden="true">
        <span {...stylex.props(styles.dot, styles.dot1)} />
        <span {...stylex.props(styles.dot, styles.dot2)} />
        <span {...stylex.props(styles.dot, styles.dot3)} />
      </span>
    </div>
  );
}
