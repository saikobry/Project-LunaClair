import type { ReactNode, KeyboardEvent } from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
});

export interface SelectableRowProps {
  selected?: boolean;
  onToggle: () => void;
  style?: stylex.StyleXStyles;
  children: ReactNode;
}

export function SelectableRow({ onToggle, style, children }: SelectableRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      {...stylex.props(styles.row, style)}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
