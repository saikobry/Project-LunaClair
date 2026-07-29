import type { ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
    appearance: 'none',
    border: 'none',
    background: 'none',
    font: 'inherit',
    color: 'inherit',
    padding: 0,
  },
});

export interface SelectableRowProps {
  selected?: boolean;
  onToggle: () => void;
  style?: stylex.StyleXStyles;
  children: ReactNode;
}

export function SelectableRow({ onToggle, style, children }: SelectableRowProps) {
  return (
    <button
      type="button"
      {...stylex.props(styles.row, style)}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}
