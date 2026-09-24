import * as stylex from '@stylexjs/stylex';
import {
  Save,
  RotateCcw,
  Copy,
  Download,
  Check,
  FileCode,
  FileEdit,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { SaveStatus } from './MaterialWriterTab';

const styles = stylex.create({
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    padding: '10px 14px',
    backgroundColor: 'var(--color-background-surface)',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 999,
  },
  statusSaved: {
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
  },
  statusDirty: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: 'var(--color-warning)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  statusSaving: {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
    color: 'var(--color-accent)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--color-error)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  retryBtn: {
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 4,
    backgroundColor: 'var(--color-error)',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    marginLeft: 4,
    transition: 'background-color 0.15s ease',
    ':hover': {
      backgroundColor: '#b91c1c',
    },
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 500,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  btnPrimary: {
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: '#ffffff',
    fontWeight: 600,
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 85%, black)',
      color: '#ffffff',
    },
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    ':hover': {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
    },
  },
  btnPrimaryDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: '#ffffff',
    ':hover': {
      backgroundColor: 'var(--color-accent)',
      color: '#ffffff',
    },
  },
});

export interface WriterActionBarProps {
  saveStatus: SaveStatus;
  isRawMode: boolean;
  isDirty: boolean;
  isSaving: boolean;
  copied: boolean;
  onToggleMode: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

function SaveStatusBadge({ saveStatus, onRetry }: { saveStatus: SaveStatus; onRetry: () => void }) {
  return (
    <span
      {...stylex.props(
        styles.statusBadge,
        saveStatus === 'saved' && styles.statusSaved,
        saveStatus === 'unsaved' && styles.statusDirty,
        saveStatus === 'saving' && styles.statusSaving,
        saveStatus === 'error' && styles.statusError,
      )}
      role="status"
      aria-live="polite"
    >
      {saveStatus === 'saving' && (
        <>
          <Loader2 size={13} />
          Saving to Library...
        </>
      )}
      {saveStatus === 'error' && (
        <>
          <AlertCircle size={13} color="var(--color-error)" />
          Save failed
          <button
            type="button"
            {...stylex.props(styles.retryBtn)}
            onClick={onRetry}
            title="Retry saving current draft"
          >
            Retry
          </button>
        </>
      )}
      {saveStatus === 'unsaved' && <>● Unsaved changes</>}
      {saveStatus === 'saved' && (
        <>
          <Check size={13} color="var(--color-success)" /> Saved to Library
        </>
      )}
    </span>
  );
}

export function WriterActionBar({
  saveStatus,
  isRawMode,
  isDirty,
  isSaving,
  copied,
  onToggleMode,
  onCopy,
  onDownload,
  onDiscard,
  onSave,
}: WriterActionBarProps) {
  return (
    <div {...stylex.props(styles.actionBar)}>
      <div {...stylex.props(styles.leftGroup)}>
        <SaveStatusBadge saveStatus={saveStatus} onRetry={onSave} />
      </div>

      <div {...stylex.props(styles.rightGroup)}>
        <button
          type="button"
          {...stylex.props(styles.btn)}
          onClick={onToggleMode}
          title={isRawMode ? 'Switch to Visual WYSIWYG Editor' : 'Switch to Raw Markdown Source'}
        >
          {isRawMode ? <FileEdit size={13} /> : <FileCode size={13} />}
          {isRawMode ? 'Visual Editor' : 'Raw Markdown'}
        </button>

        <button
          type="button"
          {...stylex.props(styles.btn)}
          onClick={onCopy}
          title="Copy Markdown"
        >
          {copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>

        <button
          type="button"
          {...stylex.props(styles.btn)}
          onClick={onDownload}
          title="Download .md File"
        >
          <Download size={13} />
          Export .md
        </button>

        <button
          type="button"
          {...stylex.props(styles.btn, !isDirty && styles.btnDisabled)}
          onClick={onDiscard}
          disabled={!isDirty}
          title="Discard unsaved edits and restore last saved state"
        >
          <RotateCcw size={13} />
          Discard
        </button>

        <button
          type="button"
          {...stylex.props(
            styles.btn,
            styles.btnPrimary,
            (!isDirty || isSaving) && styles.btnPrimaryDisabled,
          )}
          onClick={onSave}
          disabled={!isDirty || isSaving}
          title="Save changes to local library (Ctrl+S)"
        >
          <Save size={13} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
