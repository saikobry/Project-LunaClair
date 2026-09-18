import * as stylex from '@stylexjs/stylex';
import { Bot, GraduationCap } from 'lucide-react';

const styles = stylex.create({
  // Replicates the workspace Study/Manage switch: muted track (radius 10),
  // borderless buttons (13px/600), surface thumb for the active tab. Kept
  // custom for the tablist semantics + count badges; focus ring and badges
  // are the only additions over the source.
  container: {
    display: 'inline-flex',
    gap: 2,
    padding: 3,
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 10,
  },
  button: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '7px 16px',
    borderRadius: 8,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  buttonActive: {
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
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
    backgroundColor: 'var(--color-neutral)',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  badgeActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
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
