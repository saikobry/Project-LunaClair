import type { ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  chip: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: 'var(--color-accent)',
    background: 'var(--color-accent-muted)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full, 9999px)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
});

export interface ChipProps {
  children: ReactNode;
  style?: stylex.StyleXStyles;
}

export function Chip({ children, style }: ChipProps) {
  return <span {...stylex.props(styles.chip, style)}>{children}</span>;
}
