import type { ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  chip: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full, 9999px)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  accent: {
    color: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent-muted)',
  },
  neutral: {
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
  },
});

export interface ChipProps {
  children: ReactNode;
  variant?: 'accent' | 'neutral';
  style?: stylex.StyleXStyles;
}

export function Chip({ children, variant = 'accent', style }: ChipProps) {
  return (
    <span
      {...stylex.props(
        styles.chip,
        variant === 'neutral' ? styles.neutral : styles.accent,
        style,
      )}
    >
      {children}
    </span>
  );
}
