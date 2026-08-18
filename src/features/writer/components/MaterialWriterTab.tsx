import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Save,
  RotateCcw,
  Copy,
  Download,
  Check,
  FileCode,
  FileEdit,
  FileQuestion,
} from 'lucide-react';
import { useMaterial } from '../../catalog/materials/hooks/queries/useMaterial';
import { useDocument } from '../../reader/hooks/useDocument';
import { useUpdateDocumentContent } from '../hooks/mutations/useUpdateDocumentContent';
import { WriterEditor } from './WriterEditor';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    padding: '10px 14px',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, #e5e7eb)',
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
    backgroundColor: 'var(--color-background-muted, #f3f4f6)',
    color: 'var(--color-text-secondary, #6b7280)',
    border: '1px solid var(--color-border, #e5e7eb)',
  },
  statusDirty: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#d97706',
    border: '1px solid rgba(245, 158, 11, 0.3)',
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
    borderColor: 'var(--color-border, #e5e7eb)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary, #4b5563)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted, #f3f4f6)',
      color: 'var(--color-text-primary, #111827)',
    },
  },
  btnPrimary: {
    backgroundColor: 'var(--color-accent, #2563eb)',
    borderColor: 'var(--color-accent, #2563eb)',
    color: '#ffffff',
    fontWeight: 600,
    ':hover': {
      backgroundColor: 'var(--color-accent-hover, #1d4ed8)',
      color: '#ffffff',
    },
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    ':hover': {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary, #4b5563)',
    },
  },
  btnPrimaryDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: 'var(--color-accent, #2563eb)',
    borderColor: 'var(--color-accent, #2563eb)',
    color: '#ffffff',
    ':hover': {
      backgroundColor: 'var(--color-accent, #2563eb)',
      color: '#ffffff',
    },
  },
  rawEditorArea: {
    width: '100%',
    height: 580,
    fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
    fontSize: 13,
    lineHeight: 1.55,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, #e5e7eb)',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    boxSizing: 'border-box',
    outline: 'none',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary, #6b7280)',
    fontSize: 14,
  },
});

interface MaterialWriterTabProps {
  materialId: string;
}

export function MaterialWriterTab({ materialId }: MaterialWriterTabProps) {
  const { material, isLoading: isMaterialLoading } = useMaterial(materialId);
  const { data: doc, isLoading: isDocLoading, error: docError } = useDocument(material ?? null);
  const updateContentMutation = useUpdateDocumentContent();

  const savedMarkdown = useMemo(() => doc?.content ?? '', [doc?.content]);
  // null indicates clean/unmodified state (synced to savedMarkdown)
  const [liveMarkdown, setLiveMarkdown] = useState<string | null>(null);
  const currentMarkdown = liveMarkdown ?? savedMarkdown;

  const [isRawMode, setIsRawMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editorKey, setEditorKey] = useState<number>(0);

  const isDirty = useMemo(() => {
    return liveMarkdown !== null && liveMarkdown.trim() !== savedMarkdown.trim();
  }, [liveMarkdown, savedMarkdown]);

  const handleEditorChange = useCallback((markdown: string) => {
    setLiveMarkdown(markdown);
  }, []);

  const handleSave = useCallback(async () => {
    if (!material || !isDirty || updateContentMutation.isPending) return;

    await updateContentMutation.mutateAsync({
      materialId: material.id,
      documentId: material.documentId,
      title: material.title,
      content: currentMarkdown,
    });
    setLiveMarkdown(null);
  }, [material, isDirty, updateContentMutation, currentMarkdown]);

  const handleDiscard = useCallback(() => {
    setLiveMarkdown(null);
    setEditorKey((prev) => prev + 1);
  }, []);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownload = () => {
    const blob = new Blob([currentMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${material?.documentId || materialId}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcut: Cmd/Ctrl + S to save
  const handleSaveRef = useRef(handleSave);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    handleSaveRef.current = handleSave;
    isDirtyRef.current = isDirty;
  }, [handleSave, isDirty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirtyRef.current) {
          handleSaveRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isMaterialLoading || isDocLoading) {
    return <div {...stylex.props(styles.loadingState)}>Loading document editor...</div>;
  }

  if (!material || docError) {
    return (
      <ErrorState
        icon={<FileQuestion size={28} />}
        title="Could not load document for editing"
        description="The material or its associated document could not be found."
      />
    );
  }

  return (
    <div {...stylex.props(styles.root)}>
      {/* Top Action Bar */}
      <div {...stylex.props(styles.actionBar)}>
        <div {...stylex.props(styles.leftGroup)}>
          <span
            {...stylex.props(
              styles.statusBadge,
              isDirty ? styles.statusDirty : styles.statusSaved,
            )}
          >
            {isDirty ? (
              <>● Unsaved changes</>
            ) : (
              <>
                <Check size={13} color="#16a34a" /> Saved to Library
              </>
            )}
          </span>
        </div>

        <div {...stylex.props(styles.rightGroup)}>
          <button
            type="button"
            {...stylex.props(styles.btn)}
            onClick={() => setIsRawMode((prev) => !prev)}
            title={isRawMode ? 'Switch to Visual WYSIWYG Editor' : 'Switch to Raw Markdown Source'}
          >
            {isRawMode ? <FileEdit size={13} /> : <FileCode size={13} />}
            {isRawMode ? 'Visual Editor' : 'Raw Markdown'}
          </button>

          <button
            type="button"
            {...stylex.props(styles.btn)}
            onClick={handleCopyMarkdown}
            title="Copy Markdown"
          >
            {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            type="button"
            {...stylex.props(styles.btn)}
            onClick={handleDownload}
            title="Download .md File"
          >
            <Download size={13} />
            Export .md
          </button>

          <button
            type="button"
            {...stylex.props(styles.btn, !isDirty && styles.btnDisabled)}
            onClick={handleDiscard}
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
              (!isDirty || updateContentMutation.isPending) && styles.btnPrimaryDisabled,
            )}
            onClick={handleSave}
            disabled={!isDirty || updateContentMutation.isPending}
            title="Save changes to local library (Ctrl+S)"
          >
            <Save size={13} />
            {updateContentMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      {!isRawMode ? (
        <WriterEditor
          key={`${materialId}-${editorKey}`}
          initialMarkdown={savedMarkdown}
          onChange={handleEditorChange}
        />
      ) : (
        <textarea
          {...stylex.props(styles.rawEditorArea)}
          value={currentMarkdown}
          onChange={(e) => setLiveMarkdown(e.target.value)}
          placeholder="Type or paste markdown here..."
          aria-label="Raw Markdown Content"
        />
      )}
    </div>
  );
}
