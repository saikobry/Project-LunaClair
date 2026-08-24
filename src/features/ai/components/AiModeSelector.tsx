import * as stylex from '@stylexjs/stylex';
import { Bot, GraduationCap } from 'lucide-react';

const styles = stylex.create({
  container: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px',
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.05))',
    borderRadius: '10px',
    gap: 4,
  },
  button: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 12px',
    border: 'none',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary, #6b7280)',
    transition: 'all 0.15s ease',
    ':hover': {
      color: 'var(--color-text-primary, #111827)',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-primary, #6366f1)',
      outlineOffset: '1px',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  buttonActive: {
    backgroundColor: 'var(--color-surface, #ffffff)',
    color: 'var(--color-text-primary, #111827)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
    fontWeight: 600,
    ':hover': {
      backgroundColor: 'var(--color-surface, #ffffff)',
    },
  },
  icon: {
    width: 14,
    height: 14,
    flexShrink: 0,
  },
  badge: {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '10px',
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.08))',
    color: 'var(--color-text-secondary, #6b7280)',
    fontWeight: 500,
  },
  badgeActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: 'var(--color-primary, #6366f1)',
  },
});

export interface AiModeSelectorProps {
  currentMode: 'assistant' | 'socratic';
  onModeChange: (mode: 'assistant' | 'socratic') => void;
  assistantMessageCount?: number;
  socraticMessageCount?: number;
  disabled?: boolean;
}

export function AiModeSelector({
  currentMode,
  onModeChange,
  assistantMessageCount,
  socraticMessageCount,
  disabled = false,
}: AiModeSelectorProps) {
  return (
    <div
      {...stylex.props(styles.container)}
      role="tablist"
      aria-label="AI Tutor Mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={currentMode === 'assistant'}
        aria-label="Study Assistant mode: direct explanations and study guidance"
        disabled={disabled}
        onClick={() => onModeChange('assistant')}
        {...stylex.props(
          styles.button,
          currentMode === 'assistant' && styles.buttonActive,
        )}
      >
        <Bot {...stylex.props(styles.icon)} aria-hidden="true" />
        <span>Assistant</span>
        {assistantMessageCount !== undefined && assistantMessageCount > 0 && (
          <span
            {...stylex.props(
              styles.badge,
              currentMode === 'assistant' && styles.badgeActive,
            )}
          >
            {assistantMessageCount}
          </span>
        )}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={currentMode === 'socratic'}
        aria-label="Socratic Tutor mode: guided learning through questions"
        disabled={disabled}
        onClick={() => onModeChange('socratic')}
        {...stylex.props(
          styles.button,
          currentMode === 'socratic' && styles.buttonActive,
        )}
      >
        <GraduationCap {...stylex.props(styles.icon)} aria-hidden="true" />
        <span>Socratic</span>
        {socraticMessageCount !== undefined && socraticMessageCount > 0 && (
          <span
            {...stylex.props(
              styles.badge,
              currentMode === 'socratic' && styles.badgeActive,
            )}
          >
            {socraticMessageCount}
          </span>
        )}
      </button>
    </div>
  );
}
