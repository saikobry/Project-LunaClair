import * as stylex from '@stylexjs/stylex';
import { GraduationCap, ClipboardList } from 'lucide-react';
import type { WorkspaceMode } from '../../../routing/routing';

const styles = stylex.create({
  switch: {
    display: 'inline-flex',
    gap: 2,
    padding: 3,
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 10,
    marginBottom: 12,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
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
  },
  pressed: {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
});

export interface WorkspaceModeSwitchProps {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

/**
 * Two-tier workspace mode switch: Study (everyday surface) vs Manage
 * (back office). Switching modes returns to the mode's last-visited tab —
 * that memory lives in the screen, this switch only reports intent.
 */
export function WorkspaceModeSwitch({ mode, onModeChange }: WorkspaceModeSwitchProps) {
  return (
    <div {...stylex.props(styles.switch)} role="tablist" aria-label="Workspace mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'study'}
        {...stylex.props(styles.button, mode === 'study' && styles.pressed)}
        onClick={() => onModeChange('study')}
      >
        <GraduationCap size={14} aria-hidden="true" />
        Study
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'manage'}
        {...stylex.props(styles.button, mode === 'manage' && styles.pressed)}
        onClick={() => onModeChange('manage')}
      >
        <ClipboardList size={14} aria-hidden="true" />
        Manage
      </button>
    </div>
  );
}
