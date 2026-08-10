import * as stylex from '@stylexjs/stylex';
import { Check } from 'lucide-react';

export interface CorrectAnswerIndicatorProps {
  /** Whether this answer option is currently marked as correct. */
  isSelected: boolean;
  /** Callback when clicked. */
  onToggle: () => void;
  /** Accessible ARIA label. */
  ariaLabel: string;
  /** Optional title attribute text for tooltips. */
  title?: string;
  /** Selection control type: 'circle' (radio-style) or 'square' (checkbox-style). @default 'circle' */
  shape?: 'circle' | 'square';
  /** Disabled state. @default false */
  isDisabled?: boolean;
}

const styles = stylex.create({
  base: {
    // StyleX drops the `all` shorthand — write the native-button resets
    // explicitly or the UA's button chrome (background + border) leaks.
    appearance: 'none',
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: 'var(--color-text-secondary)',
    padding: 0,
    font: 'inherit',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    // No background fill — the unselected state is an unshaded ring the user
    // can see; the `active` state paints the green fill.
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
    ':hover': {
      borderColor: 'var(--color-success)',
      color: 'var(--color-success)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-success)',
      outlineOffset: 2,
    },
  },
  circle: {
    borderRadius: '50%',
  },
  square: {
    borderRadius: 6,
  },
  active: {
    backgroundColor: 'var(--color-success)',
    borderColor: 'var(--color-success)',
    color: '#ffffff',
    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.25)',
    ':hover': {
      backgroundColor: 'var(--color-success)',
      borderColor: 'var(--color-success)',
      color: '#ffffff',
    },
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
});

/**
 * Reusable selection check indicator for question authoring editors.
 * Displays a styled green checkmark when selected as correct.
 */
export function CorrectAnswerIndicator({
  isSelected,
  onToggle,
  ariaLabel,
  title,
  shape = 'circle',
  isDisabled = false,
}: CorrectAnswerIndicatorProps) {
  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onToggle}
      disabled={isDisabled}
      {...stylex.props(
        styles.base,
        styles[shape],
        isSelected && styles.active,
        isDisabled && styles.disabled,
      )}
      aria-label={ariaLabel}
      title={title ?? (isSelected ? 'Correct answer' : 'Mark as correct')}
    >
      {isSelected && <Check size={16} strokeWidth={2.5} />}
    </button>
  );
}

CorrectAnswerIndicator.displayName = 'CorrectAnswerIndicator';
